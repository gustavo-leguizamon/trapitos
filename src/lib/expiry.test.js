import { describe, it, expect } from 'vitest'
import { daysSince, isAboutToExpire, freshnessText } from './expiry'

// Fecha fija de referencia para tests deterministas
const NOW = new Date('2026-06-23T12:00:00Z')
const hace = (dias) => new Date(NOW.getTime() - dias * 24 * 60 * 60 * 1000).toISOString()

describe('daysSince', () => {
  it('cuenta los días transcurridos', () => {
    expect(daysSince(hace(0), NOW)).toBe(0)
    expect(daysSince(hace(1), NOW)).toBe(1)
    expect(daysSince(hace(30), NOW)).toBe(30)
  })

  it('devuelve null con una fecha inválida', () => {
    expect(daysSince(undefined, NOW)).toBeNull()
    expect(daysSince('no-es-fecha', NOW)).toBeNull()
  })
})

describe('isAboutToExpire', () => {
  it('es false cuando la marca es reciente', () => {
    expect(isAboutToExpire(hace(10), NOW)).toBe(false)
  })

  it('es true dentro de la ventana previa al límite (90 días, ventana 14)', () => {
    expect(isAboutToExpire(hace(80), NOW)).toBe(true) // entre 76 y 89
    expect(isAboutToExpire(hace(89), NOW)).toBe(true)
  })

  it('es false una vez pasado el límite (ya debería estar caducada)', () => {
    expect(isAboutToExpire(hace(90), NOW)).toBe(false)
    expect(isAboutToExpire(hace(120), NOW)).toBe(false)
  })

  it('respeta límite y ventana custom', () => {
    expect(isAboutToExpire(hace(25), NOW, 30, 7)).toBe(true) // entre 23 y 29
    expect(isAboutToExpire(hace(10), NOW, 30, 7)).toBe(false)
  })
})

describe('freshnessText', () => {
  it('formatea la última actividad', () => {
    expect(freshnessText(hace(0), NOW)).toBe('visto hoy')
    expect(freshnessText(hace(1), NOW)).toBe('visto hace 1 día')
    expect(freshnessText(hace(5), NOW)).toBe('visto hace 5 días')
  })

  it('devuelve null si no hay fecha', () => {
    expect(freshnessText(null, NOW)).toBeNull()
  })
})
