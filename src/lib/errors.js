// Traducción de errores de Supabase a un mensaje para el usuario. Sin React ni red.

// SQLSTATE propios de los límites anti-abuso (Fase 12, supabase/schema.sql).
// PostgREST reserva el prefijo 'PT' para fijar el status HTTP de la respuesta:
// PT429 -> 429 (demasiadas acciones), PT409 -> 409 (duplicado).
export const LIMITE_FRECUENCIA = 'PT429'
export const LIMITE_DUPLICADO = 'PT409'

const CODIGOS_PROPIOS = new Set([LIMITE_FRECUENCIA, LIMITE_DUPLICADO])

// Supabase Auth limita los "Participar" por IP y responde 429 en inglés.
const MSG_AUTH_RATE_LIMIT =
  'Hubo demasiados intentos desde tu conexión. Esperá un minuto y probá de nuevo.'

// ¿Es un límite anti-abuso nuestro? Esos mensajes ya vienen escritos para el
// usuario desde la base, así que se muestran tal cual (sin prefijo técnico).
export function isLimiteAntiAbuso(error) {
  return !!error && CODIGOS_PROPIOS.has(error.code)
}

// ¿Es el límite de frecuencia de la autenticación (no de nuestras tablas)?
export function isRateLimitAuth(error) {
  return !!error && error.status === 429
}

// Mensaje a mostrar. `prefijo` da contexto ("No se pudo guardar") y solo se
// aplica a los errores técnicos: los límites ya se explican solos.
export function mensajeDeError(error, prefijo) {
  if (!error) return null
  if (isLimiteAntiAbuso(error)) return error.message
  if (isRateLimitAuth(error)) return MSG_AUTH_RATE_LIMIT
  const msg = error.message || 'Ocurrió un error inesperado.'
  return prefijo ? `${prefijo}: ${msg}` : msg
}
