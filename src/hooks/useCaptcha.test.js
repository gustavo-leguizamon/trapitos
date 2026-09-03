import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCaptcha } from './useCaptcha'

const SITE_KEY = '0x4AAAAAAAtest'

// Turnstile falso: guarda las opciones del render para poder disparar los
// callbacks a mano, como haría Cloudflare.
function fakeTurnstile() {
  const api = {
    opciones: null,
    render: vi.fn((_container, opciones) => {
      api.opciones = opciones
      return 'widget-1'
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  }
  return api
}

// El hook necesita que containerRef apunte a un nodo real del DOM.
function renderCaptcha(siteKey = SITE_KEY) {
  const hook = renderHook(() => useCaptcha(siteKey))
  const container = document.createElement('div')
  document.body.appendChild(container)
  hook.result.current.containerRef.current = container
  return hook
}

describe('useCaptcha', () => {
  beforeEach(() => {
    window.turnstile = fakeTurnstile()
  })

  afterEach(() => {
    delete window.turnstile
    document.body.innerHTML = ''
  })

  it('queda apagado sin clave configurada y no toca Turnstile', async () => {
    const { result } = renderCaptcha('')

    expect(result.current.enabled).toBe(false)
    await expect(result.current.getToken()).resolves.toBeNull()
    expect(window.turnstile.render).not.toHaveBeenCalled()
  })

  it('con clave, monta el widget y resuelve con el token', async () => {
    const { result } = renderCaptcha()

    expect(result.current.enabled).toBe(true)

    let token
    await act(async () => {
      const pedido = result.current.getToken().then((t) => (token = t))
      // Esperamos a que el render ocurra antes de simular la respuesta.
      await Promise.resolve()
      window.turnstile.opciones.callback('tok-abc')
      await pedido
    })

    expect(window.turnstile.render).toHaveBeenCalledTimes(1)
    expect(window.turnstile.render.mock.calls[0][1].sitekey).toBe(SITE_KEY)
    expect(token).toBe('tok-abc')
  })

  it('el segundo pedido reinicia el widget y vuelve a resolver', async () => {
    const { result } = renderCaptcha()

    await act(async () => {
      const pedido = result.current.getToken()
      await Promise.resolve()
      window.turnstile.opciones.callback('tok-1')
      await pedido
    })

    let segundo
    await act(async () => {
      const pedido = result.current.getToken().then((t) => (segundo = t))
      await Promise.resolve()
      // Los callbacks se registraron en el primer render: tienen que seguir
      // sirviendo al pedido vigente (los tokens son de un solo uso).
      window.turnstile.opciones.callback('tok-2')
      await pedido
    })

    expect(window.turnstile.render).toHaveBeenCalledTimes(1)
    expect(window.turnstile.reset).toHaveBeenCalledWith('widget-1')
    expect(segundo).toBe('tok-2')
  })

  it('rechaza con un mensaje legible si Turnstile falla', async () => {
    const { result } = renderCaptcha()

    await act(async () => {
      const pedido = result.current.getToken()
      await Promise.resolve()
      window.turnstile.opciones['error-callback']()
      await expect(pedido).rejects.toThrow(/no se pudo verificar/i)
    })
  })

  it('dos pedidos simultáneos comparten el mismo token', async () => {
    const { result } = renderCaptcha()

    const tokens = []
    await act(async () => {
      const a = result.current.getToken().then((t) => tokens.push(t))
      const b = result.current.getToken().then((t) => tokens.push(t))
      await Promise.resolve()
      window.turnstile.opciones.callback('tok-unico')
      await Promise.all([a, b])
    })

    expect(window.turnstile.render).toHaveBeenCalledTimes(1)
    expect(tokens).toEqual(['tok-unico', 'tok-unico'])
  })
})
