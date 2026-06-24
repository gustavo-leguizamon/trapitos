import { describe, it, expect } from 'vitest'
import {
  buildOverpassQuery,
  parseOverpassWays,
  nodeUsageCounts,
  extractBlock,
  haversineM,
  getBlockForPoint,
} from './street'

// Respuesta Overpass sintética: una calle horizontal ("Calle Falsa") sobre lat=0
// con vértices cada 0.001° de lng, cruzada por dos calles en lng -0.001 y +0.001.
// Los nodos 2 y 4 son compartidos => esquinas que limitan la cuadra del medio.
function fakeResponse() {
  return {
    elements: [
      {
        type: 'way',
        id: 100,
        tags: { highway: 'residential', name: 'Calle Falsa' },
        nodes: [1, 2, 3, 4, 5],
        geometry: [
          { lon: -0.002, lat: 0 },
          { lon: -0.001, lat: 0 },
          { lon: 0, lat: 0 },
          { lon: 0.001, lat: 0 },
          { lon: 0.002, lat: 0 },
        ],
      },
      // Cruce oeste (comparte el nodo 2)
      {
        type: 'way',
        id: 200,
        tags: { highway: 'residential', name: 'Cruce Oeste' },
        nodes: [2, 20],
        geometry: [
          { lon: -0.001, lat: 0 },
          { lon: -0.001, lat: 0.001 },
        ],
      },
      // Cruce este (comparte el nodo 4)
      {
        type: 'way',
        id: 300,
        tags: { highway: 'residential', name: 'Cruce Este' },
        nodes: [4, 30],
        geometry: [
          { lon: 0.001, lat: 0 },
          { lon: 0.001, lat: 0.001 },
        ],
      },
    ],
  }
}

describe('buildOverpassQuery', () => {
  it('incluye el punto y el radio, y pide geometría', () => {
    const q = buildOverpassQuery(-34.6, -58.4, 150)
    expect(q).toContain('around:150,-34.6,-58.4')
    expect(q).toContain('out geom;')
  })

  it('excluye veredas y senderos peatonales', () => {
    expect(buildOverpassQuery(0, 0)).toContain('footway')
  })
})

describe('parseOverpassWays', () => {
  it('normaliza los way a coords [lng,lat] y nodeIds alineados', () => {
    const ways = parseOverpassWays(fakeResponse())
    expect(ways).toHaveLength(3)
    expect(ways[0].name).toBe('Calle Falsa')
    expect(ways[0].coords[1]).toEqual([-0.001, 0])
    expect(ways[0].nodeIds).toEqual([1, 2, 3, 4, 5])
  })

  it('descarta elementos sin geometría o inconsistentes', () => {
    const json = {
      elements: [
        { type: 'node', id: 1 },
        { type: 'way', id: 2, nodes: [1, 2], geometry: [{ lon: 0, lat: 0 }] }, // largos !=
      ],
    }
    expect(parseOverpassWays(json)).toHaveLength(0)
  })
})

describe('nodeUsageCounts', () => {
  it('marca como esquinas los nodos compartidos por 2+ calles', () => {
    const counts = nodeUsageCounts(parseOverpassWays(fakeResponse()))
    expect(counts.get(2)).toBe(2) // compartido calle + cruce oeste
    expect(counts.get(4)).toBe(2) // compartido calle + cruce este
    expect(counts.get(3)).toBe(1) // medio de cuadra, no es esquina
  })
})

describe('extractBlock', () => {
  it('recorta la cuadra entre las dos esquinas más cercanas al punto', () => {
    const ways = parseOverpassWays(fakeResponse())
    const block = extractBlock(ways, 0, 0) // click en el medio de la cuadra
    expect(block).not.toBeNull()
    expect(block.name).toBe('Calle Falsa')
    // La cuadra va de esquina a esquina: lng -0.001 .. +0.001
    const lngs = block.coords.map((c) => c[0])
    expect(Math.min(...lngs)).toBeCloseTo(-0.001, 6)
    expect(Math.max(...lngs)).toBeCloseTo(0.001, 6)
    // No se extiende más allá de las esquinas
    expect(lngs.every((x) => x >= -0.001 - 1e-9 && x <= 0.001 + 1e-9)).toBe(true)
  })

  it('elige la calle más cercana cuando hay varias', () => {
    const ways = parseOverpassWays(fakeResponse())
    // Punto pegado al cruce este (calle vertical) pero sobre la horizontal:
    const block = extractBlock(ways, 0, 0)
    expect(block.coords.length).toBeGreaterThanOrEqual(2)
  })

  it('aplica el tope por lado si no hay esquinas (calle larga sin cruces)', () => {
    const soloCalle = {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { highway: 'residential', name: 'Ruta Larga' },
          nodes: [1, 2],
          geometry: [
            { lon: 0, lat: 0 },
            { lon: 0.02, lat: 0 }, // ~2.2 km de largo, sin cruces
          ],
        },
      ],
    }
    const ways = parseOverpassWays(soloCalle)
    const block = extractBlock(ways, 0, 0.01, 130) // click a mitad de la ruta
    // Cada lado se corta a ~130 m, así que el tramo total ronda 260 m, no 2 km.
    const largo = block.coords
      .slice(1)
      .reduce((acc, c, i) => acc + haversineM(block.coords[i], c), 0)
    expect(largo).toBeLessThan(400)
    expect(largo).toBeGreaterThan(150)
  })
})

describe('getBlockForPoint', () => {
  const endpoints = ['a', 'b', 'c']

  it('devuelve la cuadra usando el fetch inyectado', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => fakeResponse() })
    const block = await getBlockForPoint(0, 0, { fetchFn, endpoints })
    expect(block.name).toBe('Calle Falsa')
  })

  it('devuelve null si la red falla (para que el llamador use respaldo)', async () => {
    const fetchFn = async () => {
      throw new Error('network down')
    }
    expect(await getBlockForPoint(0, 0, { fetchFn, endpoints })).toBeNull()
  })

  it('devuelve null si Overpass responde sin calles', async () => {
    const fetchFn = async () => ({ ok: true, json: async () => ({ elements: [] }) })
    expect(await getBlockForPoint(0, 0, { fetchFn, endpoints })).toBeNull()
  })

  it('prueba el siguiente servidor si el primero falla o limita (429)', async () => {
    const calls = []
    const fetchFn = async (url) => {
      calls.push(url)
      if (url === 'a') throw new Error('caído')
      if (url === 'b') return { ok: false, status: 429 }
      return { ok: true, json: async () => fakeResponse() } // 'c' responde
    }
    const block = await getBlockForPoint(0, 0, { fetchFn, endpoints })
    expect(block.name).toBe('Calle Falsa')
    expect(calls).toEqual(['a', 'b', 'c'])
  })

  it('amplía el radio si en el primero no hay calles', async () => {
    const radios = []
    const fetchFn = async (_url, opts) => {
      const m = opts.body.match(/around:(\d+)/)
      radios.push(Number(m[1]))
      // Solo el radio ampliado (segundo intento) trae calles.
      const hay = radios.length > 1
      return { ok: true, json: async () => (hay ? fakeResponse() : { elements: [] }) }
    }
    const block = await getBlockForPoint(0, 0, { fetchFn, endpoints })
    expect(block).not.toBeNull()
    expect(radios.length).toBe(2)
    expect(radios[1]).toBeGreaterThan(radios[0])
  })
})
