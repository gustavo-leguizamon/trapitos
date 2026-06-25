// Lógica pura de proximidad. Sin React ni red.

const R_TIERRA_M = 6371000 // radio de la Tierra en metros

const toRad = (deg) => (deg * Math.PI) / 180

// Distancia en metros entre dos puntos (lat/lng) con la fórmula de Haversine.
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R_TIERRA_M * Math.asin(Math.sqrt(a))
}

// Determina qué trapitos hay que notificar al usuario, evitando avisos repetidos.
// Usa histéresis: avisa al entrar dentro de `notifyRadius` y "olvida" el aviso
// recién cuando el usuario se aleja más allá de `clearRadius` (clearRadius > notifyRadius).
//
//   userPos: { lat, lng }
//   spots:   array de { id, lat, lng, ... }
//   notified: Set de ids ya avisados (no se muta; se devuelve uno nuevo)
//
// Devuelve { toNotify: [{...spot, distance}], notified: Set }.
export function computeProximityAlerts(
  userPos,
  spots = [],
  { notifyRadius = 150, clearRadius = 300, notified = new Set() } = {}
) {
  const next = new Set(notified)
  const toNotify = []

  if (!userPos || typeof userPos.lat !== 'number' || typeof userPos.lng !== 'number') {
    return { toNotify, notified: next }
  }

  for (const spot of spots) {
    if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') continue
    const distance = distanceMeters(userPos.lat, userPos.lng, spot.lat, spot.lng)

    if (distance <= notifyRadius) {
      if (!next.has(spot.id)) {
        next.add(spot.id)
        toNotify.push({ ...spot, distance })
      }
    } else if (distance > clearRadius) {
      next.delete(spot.id) // se alejó: la próxima vez que entre, vuelve a avisar
    }
    // entre notifyRadius y clearRadius: zona muerta, no cambia nada
  }

  return { toNotify, notified: next }
}
