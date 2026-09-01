// Captcha opcional para el login anónimo (Cloudflare Turnstile). Sin React ni red.
//
// Por qué: crear cuentas anónimas no cuesta nada, así que los límites de la base
// (Fase 12) acotan el daño pero no frenan la fábrica de cuentas. El captcha sí.
//
// Es opcional a propósito: se activa solo si `VITE_TURNSTILE_SITE_KEY` está
// definida. Sin la variable la app funciona igual que siempre (desarrollo, tests
// y cualquiera que todavía no lo haya configurado).

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script'

// Clave pública del sitio, o '' si no está configurada.
export function siteKeyFromEnv(env = import.meta.env) {
  const key = env?.VITE_TURNSTILE_SITE_KEY
  return typeof key === 'string' ? key.trim() : ''
}

// El captcha está activo solo si hay una clave de sitio.
export function isCaptchaEnabled(siteKey) {
  return typeof siteKey === 'string' && siteKey.trim().length > 0
}

// Opciones para supabase.auth.signInAnonymously(). Sin token no mandamos
// `options`. Al revés no hay problema: si el captcha está apagado del lado de
// Supabase, el token que mandemos de más se ignora.
export function signInOptions(captchaToken) {
  return captchaToken ? { options: { captchaToken } } : {}
}
