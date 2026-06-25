// Helpers geoespaciales puros (sin dependencias de React/Supabase),
// fáciles de testear de forma aislada.

// Construye el punto en formato WKT que espera la columna `geom` (PostGIS).
// Ojo: WKT usa el orden (lng lat), al revés de como solemos decir "lat, lng".
export function toPointWKT(lat, lng) {
  return `SRID=4326;POINT(${lng} ${lat})`
}

// Construye la LINESTRING en WKT para la columna `geom_calle` (la cuadra).
// `coords` viene como [[lng, lat], ...] (orden de GeoJSON / PostGIS).
export function toLineWKT(coords) {
  const pts = coords.map(([lng, lat]) => `${lng} ${lat}`).join(', ')
  return `SRID=4326;LINESTRING(${pts})`
}

// Agranda un poco el radio visible para incluir trapitos justo en el borde
// del mapa, con un mínimo razonable para zooms muy cercanos.
export function paddedRadius(radius, factor = 1.2, min = 500) {
  return Math.max(radius * factor, min)
}
