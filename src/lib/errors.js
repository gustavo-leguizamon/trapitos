// Traducción de errores de Supabase a un mensaje para el usuario. Sin React ni red.

// SQLSTATE propios de los límites anti-abuso (Fase 12, supabase/schema.sql).
// PostgREST reserva el prefijo 'PT' para fijar el status HTTP de la respuesta:
// PT429 -> 429 (demasiadas acciones), PT409 -> 409 (duplicado).
export const LIMITE_FRECUENCIA = 'PT429'
export const LIMITE_DUPLICADO = 'PT409'
// Del backoffice (Fase 13): PT403 -> 403 (no sos admin), PT422 -> 422 (dato inválido).
export const PERMISO_DENEGADO = 'PT403'
export const DATO_INVALIDO = 'PT422'

const CODIGOS_PROPIOS = new Set([LIMITE_FRECUENCIA, LIMITE_DUPLICADO])

// Todo 'PTxxx' es un error que levantamos nosotros desde la base, con un
// mensaje ya escrito para quien lo lee. Nadie más usa ese prefijo.
const CODIGO_PROPIO_RE = /^PT\d{3}$/

// Supabase Auth limita los "Participar" por IP y responde 429 en inglés.
const MSG_AUTH_RATE_LIMIT =
  'Hubo demasiados intentos desde tu conexión. Esperá un minuto y probá de nuevo.'

// ¿Es un límite anti-abuso nuestro? (frecuencia o duplicado, no cualquier PT)
export function isLimiteAntiAbuso(error) {
  return !!error && CODIGOS_PROPIOS.has(error.code)
}

// ¿El mensaje viene redactado desde la base? (cualquier 'PTxxx' nuestro)
export function esMensajeDeLaBase(error) {
  return !!error && typeof error.code === 'string' && CODIGO_PROPIO_RE.test(error.code)
}

// ¿Es el límite de frecuencia de la autenticación (no de nuestras tablas)?
export function isRateLimitAuth(error) {
  return !!error && error.status === 429
}

// Mensaje a mostrar. `prefijo` da contexto ("No se pudo guardar") y solo se
// aplica a los errores técnicos: los nuestros ya se explican solos.
export function mensajeDeError(error, prefijo) {
  if (!error) return null
  if (esMensajeDeLaBase(error)) return error.message
  if (isRateLimitAuth(error)) return MSG_AUTH_RATE_LIMIT
  const msg = error.message || 'Ocurrió un error inesperado.'
  return prefijo ? `${prefijo}: ${msg}` : msg
}
