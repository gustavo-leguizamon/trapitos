import { describe, it, expect } from 'vitest'
import {
  LIMITE_FRECUENCIA,
  LIMITE_DUPLICADO,
  PERMISO_DENEGADO,
  DATO_INVALIDO,
  esMensajeDeLaBase,
  isLimiteAntiAbuso,
  isRateLimitAuth,
  mensajeDeError,
} from './errors'

describe('isLimiteAntiAbuso', () => {
  it('reconoce los SQLSTATE propios', () => {
    expect(isLimiteAntiAbuso({ code: LIMITE_FRECUENCIA })).toBe(true)
    expect(isLimiteAntiAbuso({ code: LIMITE_DUPLICADO })).toBe(true)
  })

  it('rechaza otros errores de Postgres', () => {
    expect(isLimiteAntiAbuso({ code: '23505' })).toBe(false)
    expect(isLimiteAntiAbuso({ message: 'network error' })).toBe(false)
    expect(isLimiteAntiAbuso(null)).toBe(false)
  })
})

describe('esMensajeDeLaBase', () => {
  it('reconoce cualquier PTxxx nuestro', () => {
    expect(esMensajeDeLaBase({ code: LIMITE_FRECUENCIA })).toBe(true)
    expect(esMensajeDeLaBase({ code: LIMITE_DUPLICADO })).toBe(true)
    expect(esMensajeDeLaBase({ code: PERMISO_DENEGADO })).toBe(true)
    expect(esMensajeDeLaBase({ code: DATO_INVALIDO })).toBe(true)
  })

  it('rechaza los errores que no levantamos nosotros', () => {
    expect(esMensajeDeLaBase({ code: '23505' })).toBe(false)
    expect(esMensajeDeLaBase({ code: 'PGRST301' })).toBe(false)
    expect(esMensajeDeLaBase({ message: 'network error' })).toBe(false)
    expect(esMensajeDeLaBase(null)).toBe(false)
  })
})

describe('isRateLimitAuth', () => {
  it('reconoce el 429 de la autenticación', () => {
    expect(isRateLimitAuth({ status: 429, message: 'Request rate limit reached' })).toBe(true)
    expect(isRateLimitAuth({ status: 400 })).toBe(false)
    expect(isRateLimitAuth(null)).toBe(false)
  })
})

describe('mensajeDeError', () => {
  it('devuelve null si no hay error', () => {
    expect(mensajeDeError(null, 'No se pudo guardar')).toBe(null)
  })

  it('muestra los límites anti-abuso tal cual, sin prefijo', () => {
    const error = {
      code: LIMITE_FRECUENCIA,
      message: 'Llegaste al límite de 10 marcas por hora. Probá de nuevo más tarde.',
    }
    expect(mensajeDeError(error, 'No se pudo guardar')).toBe(error.message)
  })

  it('muestra el duplicado tal cual', () => {
    const error = {
      code: LIMITE_DUPLICADO,
      message: 'Ya marcaste un trapito casi en el mismo lugar.',
    }
    expect(mensajeDeError(error, 'No se pudo guardar')).toBe(error.message)
  })

  it('muestra el error de permisos del panel tal cual', () => {
    const error = { code: PERMISO_DENEGADO, message: 'Necesitás permisos de administrador.' }
    expect(mensajeDeError(error, 'No se pudo borrar')).toBe(error.message)
  })

  it('traduce el 429 de la autenticación a un mensaje en castellano', () => {
    const msg = mensajeDeError({ status: 429, message: 'Request rate limit reached' }, 'Error')
    expect(msg).toMatch(/demasiados intentos/i)
    expect(msg).not.toMatch(/rate limit/i)
  })

  it('prefija los errores técnicos', () => {
    expect(mensajeDeError({ message: 'timeout' }, 'No se pudo guardar')).toBe(
      'No se pudo guardar: timeout'
    )
  })

  it('funciona sin prefijo', () => {
    expect(mensajeDeError({ message: 'timeout' })).toBe('timeout')
  })

  it('tiene un texto de respaldo si el error no trae mensaje', () => {
    expect(mensajeDeError({}, 'No se pudo guardar')).toBe(
      'No se pudo guardar: Ocurrió un error inesperado.'
    )
  })
})
