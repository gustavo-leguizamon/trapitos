import { describe, it, expect } from 'vitest'
import { ABUSE_MOTIVOS, isMotivoValido, motivoLabel } from './abuse'

describe('ABUSE_MOTIVOS', () => {
  it('tiene los motivos esperados', () => {
    expect(ABUSE_MOTIVOS.map((m) => m.key)).toEqual(['ofensivo', 'falso', 'spam', 'otro'])
  })
})

describe('isMotivoValido', () => {
  it('acepta los válidos y rechaza el resto', () => {
    expect(isMotivoValido('spam')).toBe(true)
    expect(isMotivoValido('otro')).toBe(true)
    expect(isMotivoValido('cualquiera')).toBe(false)
    expect(isMotivoValido(undefined)).toBe(false)
  })
})

describe('motivoLabel', () => {
  it('devuelve la etiqueta del motivo', () => {
    expect(motivoLabel('ofensivo')).toBe('Ofensivo')
    expect(motivoLabel('falso')).toBe('Falso')
  })

  it('devuelve la clave si no la conoce', () => {
    expect(motivoLabel('xyz')).toBe('xyz')
  })
})
