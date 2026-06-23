// Lógica pura de antigüedad / caducidad de un trapito. Sin React ni red.
// El backend (función expirar_trapitos) usa los mismos umbrales para desactivar;
// acá los usamos para avisar al usuario antes de que eso pase.

const MS_POR_DIA = 1000 * 60 * 60 * 24

// Cuántos días pasaron desde una fecha (ISO string o Date) hasta `now`.
export function daysSince(dateLike, now = new Date()) {
  // Ojo: new Date(null) devuelve la época (1970), no una fecha inválida.
  if (dateLike == null) return null
  const then = new Date(dateLike).getTime()
  if (Number.isNaN(then)) return null
  return Math.floor((now.getTime() - then) / MS_POR_DIA)
}

// ¿La marca está por caducar? (sin actividad y dentro de la ventana previa al límite)
export function isAboutToExpire(lastActivity, now = new Date(), diasLimite = 90, ventana = 14) {
  const d = daysSince(lastActivity, now)
  if (d === null) return false
  return d >= diasLimite - ventana && d < diasLimite
}

// Texto legible de la última actividad ("visto hace N días").
export function freshnessText(lastActivity, now = new Date()) {
  const d = daysSince(lastActivity, now)
  if (d === null) return null
  if (d <= 0) return 'visto hoy'
  if (d === 1) return 'visto hace 1 día'
  return `visto hace ${d} días`
}
