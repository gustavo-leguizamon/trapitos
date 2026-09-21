// Lógica pura del backoffice. Sin React ni red.
// Los permisos NO se deciden acá: viven en la base (supabase/schema.sql, Fase 13).
// Todo esto es presentación — decide qué se ve y qué botones tiene sentido ofrecer.

import { motivoLabel } from './abuse'
import { daysSince } from './expiry'

// Ruta del panel. main.jsx la usa para decidir qué app monta.
export const ADMIN_PATH = '/admin'

// ¿Esta URL es la del panel? Tolera la barra final y no confunde /administrar.
export function isAdminPath(pathname) {
  if (typeof pathname !== 'string') return false
  const limpio = pathname.replace(/\/+$/, '')
  return limpio === ADMIN_PATH
}

// Estados posibles de una marca (los mismos que valida admin_set_status).
export const SPOT_STATUS = [
  { key: 'activo', label: 'Activo', emoji: '✅' },
  { key: 'inactivo', label: 'Caducado', emoji: '♻️' },
  { key: 'oculto', label: 'Oculto', emoji: '🚫' },
]

const POR_KEY = new Map(SPOT_STATUS.map((s) => [s.key, s]))

export function isStatusValido(key) {
  return POR_KEY.has(key)
}

export function statusLabel(key) {
  return POR_KEY.get(key)?.label ?? key ?? '—'
}

export function statusEmoji(key) {
  return POR_KEY.get(key)?.emoji ?? '❔'
}

// Cambios de estado que se le ofrecen a una marca según cómo está hoy.
// El estado actual nunca se ofrece (sería un click que no hace nada), y el
// verbo cambia según de dónde viene: "Reactivar" no es lo mismo que "Publicar".
export function accionesDeEstado(status) {
  switch (status) {
    case 'activo':
      return [
        { status: 'inactivo', label: 'Caducar' },
        { status: 'oculto', label: 'Ocultar' },
      ]
    case 'inactivo':
      return [
        { status: 'activo', label: 'Reactivar' },
        { status: 'oculto', label: 'Ocultar' },
      ]
    case 'oculto':
      return [
        { status: 'activo', label: 'Publicar' },
        { status: 'inactivo', label: 'Caducar' },
      ]
    default:
      // Estado desconocido (marca vieja o dato raro): dejamos normalizarla.
      return SPOT_STATUS.map((s) => ({ status: s.key, label: s.label }))
  }
}

// Reportes de abuso agrupados -> "Spam ×2 · Falso ×1". null si no hay ninguno.
export function motivosText(abuseMotivos) {
  if (!Array.isArray(abuseMotivos) || !abuseMotivos.length) return null
  return abuseMotivos
    .map((m) => {
      const cantidad = Number(m?.cantidad ?? 0)
      const label = motivoLabel(m?.motivo)
      return cantidad > 1 ? `${label} ×${cantidad}` : label
    })
    .join(' · ')
}

// Fila de admin_spots -> objeto para la UI.
// Los count() de Postgres son bigint y PostgREST los manda como string.
export function normalizeSpot(row) {
  if (!row) return null
  return {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    calle: row.calle || null,
    descripcion: row.descripcion || null,
    status: row.status,
    createdAt: row.created_at,
    lastActivity: row.last_activity,
    confirma: Number(row.confirma_count ?? 0),
    desmiente: Number(row.desmiente_count ?? 0),
    abuse: Number(row.abuse_count ?? 0),
    motivos: Array.isArray(row.abuse_motivos) ? row.abuse_motivos : [],
    autorId: row.autor_id || null,
    autorAnonimo: !!row.autor_anonimo,
    autorCreadoAt: row.autor_creado_at || null,
  }
}

// Quién cargó la marca, en una línea. La antigüedad de la cuenta importa: los
// límites anti-abuso y el umbral para ocultar dependen de ella (Fase 12).
export function autorText(spot, now = new Date()) {
  if (!spot?.autorId) return 'sin autor'
  const tipo = spot.autorAnonimo ? 'anónima' : 'registrada'
  const dias = daysSince(spot.autorCreadoAt, now)
  if (dias === null) return `cuenta ${tipo}`
  if (dias < 1) return `cuenta ${tipo}, de hoy`
  if (dias === 1) return `cuenta ${tipo}, de ayer`
  return `cuenta ${tipo}, hace ${dias} días`
}

// Ver el punto en OpenStreetMap (el panel no monta el mapa: no vale el peso).
export function osmLink(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const a = lat.toFixed(6)
  const b = lng.toFixed(6)
  return `https://www.openstreetmap.org/?mlat=${a}&mlon=${b}#map=18/${a}/${b}`
}
