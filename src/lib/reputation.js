// Lógica pura de reputación de usuarios. Sin React ni red.
// El backend (mi_reputacion) provee los agregados; acá derivamos puntaje y nivel.

// Pesos de cada aporte al puntaje de reputación.
export const PESOS = {
  spotCreado: 2, // por cargar un trapito
  confirmacionRecibida: 3, // alguien confirmó una marca tuya
  desmentidoRecibido: -2, // alguien dijo "ya no está" en una marca tuya
  votoEmitido: 1, // por participar votando
}

// Puntaje a partir de los agregados del usuario.
export function reputationScore({
  spotsCreados = 0,
  confirmacionesRecibidas = 0,
  desmentidosRecibidos = 0,
  votosEmitidos = 0,
} = {}) {
  return (
    spotsCreados * PESOS.spotCreado +
    confirmacionesRecibidas * PESOS.confirmacionRecibida +
    desmentidosRecibidos * PESOS.desmentidoRecibido + // PESOS.desmentidoRecibido es negativo
    votosEmitidos * PESOS.votoEmitido
  )
}

// Nivel a partir del puntaje.
//   'nuevo' | 'colaborador' | 'confiable' | 'experto'
export function reputationLevel(score) {
  if (score >= 50) return 'experto'
  if (score >= 20) return 'confiable'
  if (score >= 5) return 'colaborador'
  return 'nuevo'
}

// Etiqueta legible (emoji + texto) para mostrar.
export function reputationLabel(level) {
  switch (level) {
    case 'experto':
      return '🏆 Experto'
    case 'confiable':
      return '⭐ Confiable'
    case 'colaborador':
      return '🙂 Colaborador'
    default:
      return '🌱 Nuevo'
  }
}
