import { useCallback, useEffect, useRef } from 'react'
import {
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_SCRIPT_ID,
  isCaptchaEnabled,
  siteKeyFromEnv,
} from '../lib/captcha'

// Cuánto esperamos a que el usuario resuelva el desafío antes de rendirnos.
const TIMEOUT_MS = 60000

// El script de Turnstile se carga una sola vez para toda la app; la promesa se
// comparte entre llamadas (y entre montajes) para no insertarlo dos veces.
let scriptPromise = null

function loadTurnstile() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('El captcha no está disponible acá.'))
  }
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error('No se pudo cargar la verificación. Probá de nuevo.'))
    script.onerror = () => {
      // Que un fallo de red no deje la promesa rota para siempre.
      scriptPromise = null
      reject(new Error('No se pudo cargar la verificación. Revisá tu conexión.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

// Captcha invisible para el login anónimo.
//
// Devuelve `enabled` (hay clave configurada), `containerRef` (dónde montar el
// widget) y `getToken()`, que resuelve con el token o con `null` si el captcha
// está apagado. Con `appearance: 'interaction-only'` no se ve nada salvo que
// Cloudflare decida desafiar a quien esté del otro lado.
export function useCaptcha(siteKey = siteKeyFromEnv()) {
  const enabled = isCaptchaEnabled(siteKey)
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  // Pedido en curso: { promise, resolve, reject, timer }. Los callbacks que le
  // pasamos a Turnstile se registran una sola vez (al render del widget), así
  // que tienen que leer el pedido vigente desde acá y no desde su closure.
  const pendingRef = useRef(null)

  const settle = useCallback((ok, value) => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    clearTimeout(pending.timer)
    if (ok) pending.resolve(value)
    else pending.reject(value)
  }, [])

  // Al desmontar: cancelar lo pendiente y sacar el widget del DOM.
  useEffect(
    () => () => {
      settle(false, new Error('Verificación cancelada.'))
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          // El widget ya no existe: no hay nada que limpiar.
        }
      }
      widgetIdRef.current = null
    },
    [settle]
  )

  const getToken = useCallback(async () => {
    if (!enabled) return null

    const turnstile = await loadTurnstile()
    const container = containerRef.current
    if (!container) throw new Error('La verificación no está lista. Probá de nuevo.')

    // Si ya hay un pedido en curso, los dos esperan el mismo token.
    if (pendingRef.current) return pendingRef.current.promise

    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    const timer = setTimeout(
      () => settle(false, new Error('La verificación tardó demasiado. Probá de nuevo.')),
      TIMEOUT_MS
    )
    pendingRef.current = { promise, resolve, reject, timer }

    if (widgetIdRef.current == null) {
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        // Invisible salvo que haga falta desafiar al usuario.
        appearance: 'interaction-only',
        callback: (token) => settle(true, token),
        'error-callback': () => settle(false, new Error('No se pudo verificar. Probá de nuevo.')),
        'timeout-callback': () => settle(false, new Error('La verificación expiró. Probá de nuevo.')),
      })
    } else {
      // Los tokens son de un solo uso: para pedir otro hay que reiniciar.
      turnstile.reset(widgetIdRef.current)
    }

    return promise
  }, [enabled, siteKey, settle])

  return { enabled, containerRef, getToken }
}
