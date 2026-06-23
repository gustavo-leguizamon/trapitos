import { describe, it, expect } from 'vitest'
import { franjaFromHour, franjaFromDate, franjaLabel, rankedFranjas } from './schedule'

describe('franjaFromHour', () => {
  it('mapea cada rango horario a su franja', () => {
    expect(franjaFromHour(0)).toBe('madrugada')
    expect(franjaFromHour(5)).toBe('madrugada')
    expect(franjaFromHour(6)).toBe('manana')
    expect(franjaFromHour(11)).toBe('manana')
    expect(franjaFromHour(12)).toBe('tarde')
    expect(franjaFromHour(18)).toBe('tarde')
    expect(franjaFromHour(19)).toBe('noche')
    expect(franjaFromHour(23)).toBe('noche')
  })
})

describe('franjaFromDate', () => {
  it('usa la hora local de la fecha', () => {
    // Constructor local: 14:00 -> tarde, sin importar la zona horaria del runner
    expect(franjaFromDate(new Date(2026, 0, 1, 14, 0, 0))).toBe('tarde')
    expect(franjaFromDate(new Date(2026, 0, 1, 8, 0, 0))).toBe('manana')
  })
})

describe('franjaLabel', () => {
  it('devuelve etiqueta con emoji', () => {
    expect(franjaLabel('manana')).toMatch(/mañana/i)
    expect(franjaLabel('noche')).toMatch(/noche/i)
  })
})

describe('rankedFranjas', () => {
  it('ordena por cantidad desc y descarta vacías', () => {
    const ranked = rankedFranjas({ manana: 2, tarde: 5, noche: 0 })
    expect(ranked.map((r) => r.franja)).toEqual(['tarde', 'manana'])
    expect(ranked[0].cantidad).toBe(5)
  })

  it('devuelve [] sin datos', () => {
    expect(rankedFranjas()).toEqual([])
    expect(rankedFranjas({})).toEqual([])
    expect(rankedFranjas(null)).toEqual([])
  })

  it('ignora claves que no son franjas válidas', () => {
    expect(rankedFranjas({ basura: 9, tarde: 1 }).map((r) => r.franja)).toEqual(['tarde'])
  })
})
