// Lógica pura del "score de confianza" de un trapito a partir de los votos
// de la comunidad (confirmaciones vs. desmentidos). Sin React ni red.

// Score simple: confirmaciones menos desmentidos.
export function confidenceScore(confirma = 0, desmiente = 0) {
  return confirma - desmiente
}

// Nivel de confianza derivado del score, para mostrar y para atenuar marcas.
//   'confiable' | 'neutral' | 'dudoso'
export function confidenceLevel(confirma = 0, desmiente = 0) {
  const score = confidenceScore(confirma, desmiente)
  if (score <= -2) return 'dudoso'
  if (score >= 2) return 'confiable'
  return 'neutral'
}

// Opacidad del marcador según el nivel: los dudosos se ven atenuados.
export function levelOpacity(level) {
  switch (level) {
    case 'dudoso':
      return 0.4
    case 'confiable':
      return 1
    default:
      return 0.8
  }
}

// Color de la cuadra según el nivel de confianza (para pintarla en el mapa).
export function levelColor(level) {
  switch (level) {
    case 'dudoso':
      return '#d32f2f' // rojo
    case 'confiable':
      return '#2e7d32' // verde
    default:
      return '#f9a825' // ámbar (sin confirmar)
  }
}

// Etiqueta legible para mostrar en el popup.
export function levelLabel(level) {
  switch (level) {
    case 'dudoso':
      return '⚠️ Dudoso'
    case 'confiable':
      return '✅ Confiable'
    default:
      return '🟡 Sin confirmar'
  }
}
