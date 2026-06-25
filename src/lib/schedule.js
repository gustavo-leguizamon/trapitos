// Lógica pura de franjas horarias del trapito. Sin React ni red.
// La franja se deriva de la hora local del dispositivo (en Argentina, hora AR).

export const FRANJAS = ['madrugada', 'manana', 'tarde', 'noche']

// Franja a partir de una hora (0–23).
export function franjaFromHour(hour) {
  if (hour >= 0 && hour <= 5) return 'madrugada'
  if (hour <= 11) return 'manana'
  if (hour <= 18) return 'tarde'
  return 'noche'
}

// Franja a partir de una fecha (usa la hora local).
export function franjaFromDate(date = new Date()) {
  return franjaFromHour(date.getHours())
}

// Etiqueta legible (emoji + texto).
export function franjaLabel(franja) {
  switch (franja) {
    case 'madrugada':
      return '🌙 Madrugada'
    case 'manana':
      return '🌅 Mañana'
    case 'tarde':
      return '🌇 Tarde'
    case 'noche':
      return '🌃 Noche'
    default:
      return franja
  }
}

// Ordena las franjas por cantidad de avistajes (desc), descartando vacías.
// `horarios` es un objeto { franja: cantidad } (lo que devuelve el backend).
export function rankedFranjas(horarios = {}) {
  return Object.entries(horarios || {})
    .filter(([franja, cantidad]) => FRANJAS.includes(franja) && cantidad > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([franja, cantidad]) => ({ franja, cantidad, label: franjaLabel(franja) }))
}
