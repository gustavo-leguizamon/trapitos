import { describe, it, expect } from 'vitest'
import { distanceMeters, computeProximityAlerts } from './proximity'

describe('distanceMeters', () => {
  it('es 0 para el mismo punto', () => {
    expect(distanceMeters(-34.6, -58.4, -34.6, -58.4)).toBe(0)
  })

  it('≈111 m por 0.001° de longitud en el ecuador', () => {
    expect(distanceMeters(0, 0, 0, 0.001)).toBeCloseTo(111.32, 0)
  })

  it('calcula una distancia conocida (aprox)', () => {
    // 0.001° de latitud ≈ 111.2 m en cualquier lugar
    expect(distanceMeters(-34.6, -58.4, -34.601, -58.4)).toBeCloseTo(111.2, 0)
  })
})

describe('computeProximityAlerts', () => {
  const user = { lat: -34.6, lng: -58.4 }
  // ~111 m al sur por cada 0.001° de latitud
  const cerca = { id: 'a', lat: -34.6009, lng: -58.4 } // ~100 m
  const lejos = { id: 'b', lat: -34.605, lng: -58.4 } // ~556 m

  it('notifica un trapito dentro del radio que no estaba avisado', () => {
    const { toNotify, notified } = computeProximityAlerts(user, [cerca], { notifyRadius: 150 })
    expect(toNotify.map((s) => s.id)).toEqual(['a'])
    expect(toNotify[0].distance).toBeGreaterThan(0)
    expect(notified.has('a')).toBe(true)
  })

  it('no re-notifica un trapito ya avisado', () => {
    const { toNotify } = computeProximityAlerts(user, [cerca], {
      notifyRadius: 150,
      notified: new Set(['a']),
    })
    expect(toNotify).toEqual([])
  })

  it('no notifica trapitos fuera del radio', () => {
    const { toNotify } = computeProximityAlerts(user, [lejos], { notifyRadius: 150 })
    expect(toNotify).toEqual([])
  })

  it('olvida el aviso cuando el usuario se aleja más allá de clearRadius', () => {
    const { notified } = computeProximityAlerts(user, [lejos], {
      notifyRadius: 150,
      clearRadius: 300,
      notified: new Set(['b']),
    })
    expect(notified.has('b')).toBe(false)
  })

  it('mantiene el aviso en la zona muerta (entre ambos radios)', () => {
    const medio = { id: 'c', lat: -34.602, lng: -58.4 } // ~222 m
    const { toNotify, notified } = computeProximityAlerts(user, [medio], {
      notifyRadius: 150,
      clearRadius: 300,
      notified: new Set(['c']),
    })
    expect(toNotify).toEqual([])
    expect(notified.has('c')).toBe(true)
  })

  it('no rompe sin posición del usuario', () => {
    const { toNotify } = computeProximityAlerts(null, [cerca])
    expect(toNotify).toEqual([])
  })
})
