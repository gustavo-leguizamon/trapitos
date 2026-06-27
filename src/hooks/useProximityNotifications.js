import { useEffect, useRef } from 'react'
import { computeProximityAlerts } from '../lib/proximity'

// Muestra una notificación de forma segura.
// En Android `new Notification()` está prohibido y lanza
// "Illegal constructor. Use ServiceWorkerRegistration.showNotification()".
// Por eso usamos el service worker si está disponible, con respaldo al
// constructor en escritorio. Envuelto en try/catch: una notificación nunca
// debe romper la app.
async function showProximityNotification(title, options) {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.showNotification(title, options)
        return
      }
    }
    new Notification(title, options)
  } catch (err) {
    console.warn('No se pudo mostrar la notificación de proximidad:', err)
  }
}

// Dispara notificaciones del navegador cuando el usuario se acerca a un trapito.
// Funciona con la app abierta (primer o segundo plano). Requiere permiso concedido.
export function useProximityNotifications(userPosition, spots, enabled) {
  const notifiedRef = useRef(new Set())

  // Si se desactiva, olvidamos lo avisado para empezar limpio al reactivar.
  useEffect(() => {
    if (!enabled) notifiedRef.current = new Set()
  }, [enabled])

  useEffect(() => {
    if (!enabled || !userPosition) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const { toNotify, notified } = computeProximityAlerts(userPosition, spots, {
      notifyRadius: 150,
      clearRadius: 300,
      notified: notifiedRef.current,
    })
    notifiedRef.current = notified

    for (const spot of toNotify) {
      const titulo = spot.calle || 'Trapito'
      showProximityNotification('🅿️ Trapito cerca', {
        body: `${titulo} — a unos ${Math.round(spot.distance)} m`,
        tag: `trapito-${spot.id}`, // evita apilar la misma marca
      })
    }
  }, [userPosition, spots, enabled])
}
