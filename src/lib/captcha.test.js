import { describe, it, expect } from 'vitest'
import {
  TURNSTILE_SCRIPT_URL,
  siteKeyFromEnv,
  isCaptchaEnabled,
  signInOptions,
} from './captcha'

describe('TURNSTILE_SCRIPT_URL', () => {
  it('pide el render explícito (el widget lo montamos nosotros)', () => {
    expect(TURNSTILE_SCRIPT_URL).toContain('challenges.cloudflare.com')
    expect(TURNSTILE_SCRIPT_URL).toContain('render=explicit')
  })
})

describe('siteKeyFromEnv', () => {
  it('devuelve la clave configurada, sin espacios', () => {
    expect(siteKeyFromEnv({ VITE_TURNSTILE_SITE_KEY: '  0x4AAA  ' })).toBe('0x4AAA')
  })

  it('devuelve vacío si la variable no está', () => {
    expect(siteKeyFromEnv({})).toBe('')
    expect(siteKeyFromEnv(undefined)).toBe('')
  })
})

describe('isCaptchaEnabled', () => {
  it('se activa solo con una clave real', () => {
    expect(isCaptchaEnabled('0x4AAAAAAA')).toBe(true)
  })

  it('queda apagado sin clave (la app sigue funcionando)', () => {
    expect(isCaptchaEnabled('')).toBe(false)
    expect(isCaptchaEnabled('   ')).toBe(false)
    expect(isCaptchaEnabled(undefined)).toBe(false)
    expect(isCaptchaEnabled(null)).toBe(false)
  })
})

describe('signInOptions', () => {
  it('manda el token cuando hay captcha', () => {
    expect(signInOptions('tok-123')).toEqual({ options: { captchaToken: 'tok-123' } })
  })

  it('no manda options sin token', () => {
    expect(signInOptions(null)).toEqual({})
    expect(signInOptions(undefined)).toEqual({})
    expect(signInOptions('')).toEqual({})
  })
})
