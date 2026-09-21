import { describe, it, expect } from 'vitest'
import {
  ADMIN_PATH,
  SPOT_STATUS,
  accionesDeEstado,
  autorText,
  isAdminPath,
  isStatusValido,
  motivosText,
  normalizeSpot,
  osmLink,
  statusEmoji,
  statusLabel,
} from './admin'

describe('isAdminPath', () => {
  it('reconoce la ruta del panel, con o sin barra final', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/')).toBe(true)
    expect(isAdminPath(ADMIN_PATH)).toBe(true)
  })

  it('no confunde otras rutas que empiezan igual', () => {
    expect(isAdminPath('/')).toBe(false)
    expect(isAdminPath('/administrar')).toBe(false)
    expect(isAdminPath('/admin/spots')).toBe(false)
    expect(isAdminPath(undefined)).toBe(false)
  })
})

describe('estados', () => {
  it('valida solo los estados que entiende el resto de la app', () => {
    expect(SPOT_STATUS.map((s) => s.key)).toEqual(['activo', 'inactivo', 'oculto'])
    expect(isStatusValido('activo')).toBe(true)
    expect(isStatusValido('borrado')).toBe(false)
  })

  it('traduce el estado a algo legible', () => {
    expect(statusLabel('inactivo')).toBe('Caducado')
    expect(statusEmoji('oculto')).toBe('🚫')
  })

  it('deja pasar un estado desconocido sin romper', () => {
    expect(statusLabel('marciano')).toBe('marciano')
    expect(statusEmoji('marciano')).toBe('❔')
    expect(statusLabel(null)).toBe('—')
  })
})

describe('accionesDeEstado', () => {
  it('nunca ofrece el estado en el que ya está', () => {
    for (const { key } of SPOT_STATUS) {
      expect(accionesDeEstado(key).map((a) => a.status)).not.toContain(key)
    }
  })

  it('cambia el verbo según de dónde viene', () => {
    expect(accionesDeEstado('inactivo')[0]).toEqual({ status: 'activo', label: 'Reactivar' })
    expect(accionesDeEstado('oculto')[0]).toEqual({ status: 'activo', label: 'Publicar' })
  })

  it('ante un estado desconocido ofrece todos, para poder normalizarlo', () => {
    expect(accionesDeEstado('marciano').map((a) => a.status)).toEqual([
      'activo',
      'inactivo',
      'oculto',
    ])
  })
})

describe('motivosText', () => {
  it('resume los reportes con su etiqueta legible', () => {
    const texto = motivosText([
      { motivo: 'spam', cantidad: 2 },
      { motivo: 'falso', cantidad: 1 },
    ])
    expect(texto).toBe('Spam ×2 · Falso')
  })

  it('devuelve null si no hay reportes', () => {
    expect(motivosText([])).toBe(null)
    expect(motivosText(null)).toBe(null)
  })
})

describe('normalizeSpot', () => {
  const fila = {
    id: 'abc',
    lat: -34.6,
    lng: -58.4,
    calle: 'Mitre y San Martín',
    descripcion: '',
    status: 'activo',
    created_at: '2026-01-01T00:00:00Z',
    last_activity: '2026-02-01T00:00:00Z',
    // los count() de Postgres llegan como string
    confirma_count: '3',
    desmiente_count: '1',
    abuse_count: '0',
    abuse_motivos: null,
    autor_id: 'u1',
    autor_anonimo: true,
    autor_creado_at: '2025-12-01T00:00:00Z',
  }

  it('convierte los conteos a número', () => {
    const spot = normalizeSpot(fila)
    expect(spot.confirma).toBe(3)
    expect(spot.desmiente).toBe(1)
    expect(spot.abuse).toBe(0)
  })

  it('normaliza los vacíos: descripción vacía es null, motivos siempre un arreglo', () => {
    const spot = normalizeSpot(fila)
    expect(spot.descripcion).toBe(null)
    expect(spot.motivos).toEqual([])
  })

  it('devuelve null si no hay fila', () => {
    expect(normalizeSpot(null)).toBe(null)
  })
})

describe('autorText', () => {
  const now = new Date('2026-01-10T12:00:00Z')

  it('dice si la cuenta es anónima y cuánto vive', () => {
    const spot = { autorId: 'u1', autorAnonimo: true, autorCreadoAt: '2026-01-07T12:00:00Z' }
    expect(autorText(spot, now)).toBe('cuenta anónima, hace 3 días')
  })

  it('distingue las cuentas registradas', () => {
    const spot = { autorId: 'u1', autorAnonimo: false, autorCreadoAt: '2026-01-10T09:00:00Z' }
    expect(autorText(spot, now)).toBe('cuenta registrada, de hoy')
  })

  it('avisa cuando la marca quedó sin autor', () => {
    expect(autorText({ autorId: null }, now)).toBe('sin autor')
    expect(autorText(null, now)).toBe('sin autor')
  })
})

describe('osmLink', () => {
  it('arma el link al punto en OpenStreetMap', () => {
    expect(osmLink(-34.6, -58.4)).toContain('mlat=-34.600000&mlon=-58.400000')
  })

  it('devuelve null si las coordenadas no sirven', () => {
    expect(osmLink(null, -58.4)).toBe(null)
    expect(osmLink(NaN, NaN)).toBe(null)
  })
})
