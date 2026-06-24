import { describe, it, expect } from 'vitest'
import { toPointWKT, toLineWKT, paddedRadius } from './geo'

describe('toPointWKT', () => {
  it('arma el WKT con el orden (lng lat) que espera PostGIS', () => {
    // En Quilmes: lat -34.71, lng -58.25  ->  POINT(lng lat)
    expect(toPointWKT(-34.71, -58.25)).toBe('SRID=4326;POINT(-58.25 -34.71)')
  })

  it('no invierte las coordenadas', () => {
    const wkt = toPointWKT(10, 20)
    expect(wkt).toBe('SRID=4326;POINT(20 10)')
  })
})

describe('toLineWKT', () => {
  it('arma la LINESTRING con el orden (lng lat) que espera PostGIS', () => {
    const wkt = toLineWKT([
      [-58.25, -34.71],
      [-58.24, -34.71],
    ])
    expect(wkt).toBe('SRID=4326;LINESTRING(-58.25 -34.71, -58.24 -34.71)')
  })
})

describe('paddedRadius', () => {
  it('agranda el radio visible por el factor', () => {
    expect(paddedRadius(1000)).toBeCloseTo(1200)
  })

  it('respeta el mínimo en zooms muy cercanos', () => {
    expect(paddedRadius(100)).toBe(500)
  })

  it('permite ajustar factor y mínimo', () => {
    expect(paddedRadius(1000, 2, 100)).toBe(2000)
    expect(paddedRadius(10, 2, 100)).toBe(100)
  })
})
