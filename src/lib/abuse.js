// Motivos de reporte de abuso de una marca. Sin React ni red.

export const ABUSE_MOTIVOS = [
  { key: 'ofensivo', label: 'Ofensivo' },
  { key: 'falso', label: 'Falso' },
  { key: 'spam', label: 'Spam' },
  { key: 'otro', label: 'Otro' },
]

const VALIDOS = new Set(ABUSE_MOTIVOS.map((m) => m.key))

// ¿Es un motivo de abuso válido?
export function isMotivoValido(key) {
  return VALIDOS.has(key)
}

// Etiqueta legible de un motivo.
export function motivoLabel(key) {
  return ABUSE_MOTIVOS.find((m) => m.key === key)?.label ?? key
}
