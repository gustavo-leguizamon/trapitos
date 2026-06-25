import { describe, it, expect } from 'vitest'
import { reputationScore, reputationLevel, reputationLabel } from './reputation'

describe('reputationScore', () => {
  it('es 0 sin aportes', () => {
    expect(reputationScore()).toBe(0)
    expect(reputationScore({})).toBe(0)
  })

  it('suma por spots creados, confirmaciones y votos', () => {
    // 2*2 + 3*3 + 5*1 = 4 + 9 + 5 = 18
    expect(
      reputationScore({ spotsCreados: 2, confirmacionesRecibidas: 3, votosEmitidos: 5 })
    ).toBe(18)
  })

  it('resta por desmentidos recibidos', () => {
    // 1*2 + 0 + 4*(-2) + 0 = 2 - 8 = -6
    expect(reputationScore({ spotsCreados: 1, desmentidosRecibidos: 4 })).toBe(-6)
  })
})

describe('reputationLevel', () => {
  it('clasifica por umbrales', () => {
    expect(reputationLevel(0)).toBe('nuevo')
    expect(reputationLevel(4)).toBe('nuevo')
    expect(reputationLevel(5)).toBe('colaborador')
    expect(reputationLevel(19)).toBe('colaborador')
    expect(reputationLevel(20)).toBe('confiable')
    expect(reputationLevel(49)).toBe('confiable')
    expect(reputationLevel(50)).toBe('experto')
  })

  it('los puntajes negativos quedan como nuevo', () => {
    expect(reputationLevel(-10)).toBe('nuevo')
  })
})

describe('reputationLabel', () => {
  it('devuelve etiqueta por nivel', () => {
    expect(reputationLabel('experto')).toMatch(/experto/i)
    expect(reputationLabel('confiable')).toMatch(/confiable/i)
    expect(reputationLabel('colaborador')).toMatch(/colaborador/i)
    expect(reputationLabel('nuevo')).toMatch(/nuevo/i)
  })
})
