import { useEffect, useRef } from 'react'
import { computeProximityAlerts } from '../lib/proximity'

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
      new Notification('🅿️ Trapito cerca', {
        body: `${titulo} — a unos ${Math.round(spot.distance)} m`,
        tag: `trapito-${spot.id}`, // evita apilar la misma marca
      })
    }
  }, [userPosition, spots, enabled])
}
