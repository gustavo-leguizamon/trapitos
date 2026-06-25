// Detección de la "cuadra" por la que anda un trapito a partir de un punto.
// Consulta OpenStreetMap (Overpass API) las calles cercanas y recorta el tramo
// entre las dos esquinas (intersecciones) más cercanas al punto marcado.
//
// El grueso de la lógica son helpers PUROS (sin red) para poder testearlos:
//   parseOverpassWays · nodeUsageCounts · extractBlock · haversineM
// Solo getBlockForPoint hace la llamada de red; ante cualquier fallo devuelve
// null y el llamador cae a un comportamiento de respaldo (solo el punto).

import nearestPointOnLine from '@turf/nearest-point-on-line'
import { lineString, point } from '@turf/helpers'

// Varios servidores Overpass: si uno falla o está saturado, probamos el siguiente.
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

// Tipos de "highway" que no son calles de auto (no nos interesan para trapitos).
const HIGHWAY_EXCLUDE = 'footway|path|cycleway|steps|pedestrian|construction|proposed|track'
// Radio de contexto: traemos calles a la redonda para que entren también las
// calles transversales, y así poder detectar las esquinas que limitan la cuadra.
const CONTEXT_RADIUS_M = 150
// Tope por lado si no encontramos una esquina (calle larga sin cruces mapeados):
// recortamos a un tramo razonable centrado en el punto.
const MAX_HALF_BLOCK_M = 130

// --- Helpers geométricos puros -------------------------------------------------

// Distancia aproximada en metros entre dos coordenadas [lng, lat] (haversine).
export function haversineM([lng1, lat1], [lng2, lat2]) {
  const R = 6371000
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Interpola entre dos puntos [lng, lat] con factor t en [0, 1].
function lerp([x1, y1], [x2, y2], t) {
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
}

// Elimina puntos consecutivos prácticamente iguales (< 0.5 m), que aparecen
// cuando el punto marcado cae justo sobre un vértice de la calle.
function dedupe(coords) {
  return coords.filter((c, i) => i === 0 || haversineM(coords[i - 1], c) > 0.5)
}

// --- Parseo de la respuesta de Overpass ---------------------------------------

// Arma la consulta Overpass: calles (con geometría y nodos) alrededor del punto.
export function buildOverpassQuery(lat, lng, radius = CONTEXT_RADIUS_M) {
  return `[out:json][timeout:25];
way(around:${radius},${lat},${lng})["highway"]["highway"!~"${HIGHWAY_EXCLUDE}"];
out geom;`
}

// Normaliza los `way` de la respuesta a { id, name, coords:[[lng,lat]], nodeIds }.
// coords y nodeIds quedan alineados por índice (Overpass los devuelve así).
export function parseOverpassWays(json) {
  const elements = json?.elements || []
  const ways = []
  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || !el.nodes) continue
    if (el.geometry.length !== el.nodes.length) continue // datos inconsistentes
    ways.push({
      id: el.id,
      name: el.tags?.name || null,
      coords: el.geometry.map((g) => [g.lon, g.lat]),
      nodeIds: el.nodes,
    })
  }
  return ways
}

// Cuenta en cuántas calles aparece cada nodo. Un nodo compartido por 2+ calles
// es una esquina (intersección).
export function nodeUsageCounts(ways) {
  const counts = new Map()
  for (const w of ways) {
    for (const id of w.nodeIds) counts.set(id, (counts.get(id) || 0) + 1)
  }
  return counts
}

const isCorner = (counts, id) => (counts.get(id) || 0) >= 2

// --- Recorte de la cuadra ------------------------------------------------------

// Elige la calle más cercana al punto y devuelve dónde "cae" el punto sobre ella.
function nearestWay(ways, lat, lng) {
  const pt = point([lng, lat])
  let best = null
  for (const w of ways) {
    if (w.coords.length < 2) continue
    const snap = nearestPointOnLine(lineString(w.coords), pt, { units: 'meters' })
    const dist = snap.properties.dist
    if (!best || dist < best.dist) {
      best = {
        way: w,
        // punto proyectado sobre la calle [lng, lat]
        snapped: snap.geometry.coordinates,
        // índice del vértice donde arranca el segmento que contiene al punto
        seg: snap.properties.index,
        dist,
      }
    }
  }
  return best
}

// Camina la calle desde el punto proyectado en una dirección hasta toparse con
// una esquina o con el tope de distancia. Devuelve los vértices recorridos.
function walk(coords, nodeIds, counts, snapped, startIdx, dir, maxDist) {
  const out = []
  let prev = snapped
  let dist = 0
  for (let j = startIdx; dir > 0 ? j < coords.length : j >= 0; j += dir) {
    const v = coords[j]
    const step = haversineM(prev, v)
    if (dist + step > maxDist) {
      // No llegamos a una esquina: cortamos a la distancia tope.
      out.push(lerp(prev, v, (maxDist - dist) / step))
      return out
    }
    out.push(v)
    dist += step
    prev = v
    if (isCorner(counts, nodeIds[j])) return out // llegamos a una esquina
  }
  return out // llegamos al final de la calle
}

// A partir de las calles cercanas y el punto, devuelve la cuadra:
//   { coords: [[lng,lat], ...], name, point: [lng,lat] }
// o null si no hay calles utilizables.
export function extractBlock(ways, lat, lng, maxHalf = MAX_HALF_BLOCK_M) {
  const best = nearestWay(ways, lat, lng)
  if (!best) return null
  const counts = nodeUsageCounts(ways)
  const { way, snapped, seg } = best
  // Hacia atrás (índices menores) arranca en el vértice seg; hacia adelante en seg+1.
  const back = walk(way.coords, way.nodeIds, counts, snapped, seg, -1, maxHalf).reverse()
  const fwd = walk(way.coords, way.nodeIds, counts, snapped, seg + 1, 1, maxHalf)
  const coords = dedupe([...back, snapped, ...fwd])
  if (coords.length < 2) return null
  return { coords, name: way.name, point: snapped }
}

// --- Orquestador (con red) -----------------------------------------------------

// Ejecuta la consulta Overpass probando los servidores en orden hasta que uno
// responda OK. Aborta cada intento que tarde demasiado. Devuelve el JSON o null
// si todos fallaron (red caída, saturación, rate-limit, etc.).
async function fetchOverpass(query, fetchFn, endpoints, timeoutMs = 12000) {
  for (const url of endpoints) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
    try {
      const res = await fetchFn(url, { method: 'POST', body: query, signal: ctrl?.signal })
      if (res.ok) return await res.json()
      // 429 (rate-limit) u otros errores: probamos el siguiente servidor.
    } catch {
      // timeout o error de red: probamos el siguiente servidor.
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  return null
}

// Devuelve la cuadra para un punto, o null si Overpass falla o no hay datos.
// Reintenta con un radio mayor si en el primer radio no aparecen calles.
// `fetchFn` y `endpoints` se inyectan para poder testear sin red.
export async function getBlockForPoint(
  lat,
  lng,
  { fetchFn = fetch, radius, endpoints = OVERPASS_ENDPOINTS } = {}
) {
  // Si no piden un radio fijo, ampliamos progresivamente para zonas con pocas calles.
  const radios = radius ? [radius] : [CONTEXT_RADIUS_M, CONTEXT_RADIUS_M * 3]
  for (const r of radios) {
    const json = await fetchOverpass(buildOverpassQuery(lat, lng, r), fetchFn, endpoints)
    if (!json) return null // todos los servidores fallaron: no insistimos con el radio
    const ways = parseOverpassWays(json)
    if (ways.length) return extractBlock(ways, lat, lng)
    // No había calles en este radio: probamos con uno mayor.
  }
  return null
}
