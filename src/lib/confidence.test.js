import { describe, it, expect } from 'vitest'
import {
  confidenceScore,
  confidenceLevel,
  levelOpacity,
  levelColor,
  levelLabel,
} from './confidence'

describe('confidenceScore', () => {
  it('resta desmentidos a confirmaciones', () => {
    expect(confidenceScore(5, 2)).toBe(3)
    expect(confidenceScore(0, 0)).toBe(0)
    expect(confidenceScore(1, 4)).toBe(-3)
  })

  it('usa 0 por defecto si faltan argumentos', () => {
    expect(confidenceScore()).toBe(0)
    expect(confidenceScore(3)).toBe(3)
  })
})

describe('confidenceLevel', () => {
  it('es confiable con score >= 2', () => {
    expect(confidenceLevel(2, 0)).toBe('confiable')
    expect(confidenceLevel(5, 1)).toBe('confiable')
  })

  it('es dudoso con score <= -2', () => {
    expect(confidenceLevel(0, 2)).toBe('dudoso')
    expect(confidenceLevel(1, 5)).toBe('dudoso')
  })

  it('es neutral entre medio', () => {
    expect(confidenceLevel(0, 0)).toBe('neutral')
    expect(confidenceLevel(1, 0)).toBe('neutral')
    expect(confidenceLevel(2, 1)).toBe('neutral')
  })
})

describe('levelOpacity', () => {
  it('atenúa los dudosos', () => {
    expect(levelOpacity('dudoso')).toBe(0.4)
    expect(levelOpacity('confiable')).toBe(1)
    expect(levelOpacity('neutral')).toBe(0.8)
  })
})

describe('levelColor', () => {
  it('da un color distinto por nivel', () => {
    const colores = new Set([
      levelColor('dudoso'),
      levelColor('confiable'),
      levelColor('neutral'),
    ])
    expect(colores.size).toBe(3)
    expect(levelColor('dudoso')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('levelLabel', () => {
  it('devuelve una etiqueta por nivel', () => {
    expect(levelLabel('dudoso')).toMatch(/dudoso/i)
    expect(levelLabel('confiable')).toMatch(/confiable/i)
    expect(levelLabel('neutral')).toMatch(/sin confirmar/i)
  })
})
