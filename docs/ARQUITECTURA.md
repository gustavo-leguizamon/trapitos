# Arquitectura

## Visión general

Trapitos es una **PWA** (app web instalable) que muestra un mapa colaborativo de
trapitos. El frontend corre 100% en el navegador y habla directo con **Supabase**
(base de datos + autenticación + API), sin un backend propio.

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│  Navegador (PWA)            │         │  Supabase                │
│                             │         │                          │
│  React + Vite               │  HTTPS  │  ┌────────────────────┐  │
│   ├─ MapView (Leaflet/OSM)  │ ◄─────► │  │ Auth (anónima)     │  │
│   ├─ AddSpotForm            │         │  ├────────────────────┤  │
│   ├─ useGeolocation (GPS)   │         │  │ PostgreSQL+PostGIS  │  │
│   └─ supabaseClient         │         │  │  trapito_spots      │  │
│                             │         │  │  spots_cercanos()   │  │
└─────────────────────────────┘         │  │  RLS policies       │  │
                                         │  └────────────────────┘  │
   Tiles del mapa ◄── OpenStreetMap      └──────────────────────────┘
```

## Stack

| Capa | Tecnología | Por qué |
|------|------------|---------|
| UI | React 18 + Vite | Rápido, simple, buen DX |
| PWA | vite-plugin-pwa | Instalable en el celular, offline-ready |
| Mapa | Leaflet + react-leaflet | Open source, sin costo |
| Tiles | OpenStreetMap | Gratis para uso razonable |
| Backend | Supabase | Postgres + Auth + API sin escribir servidor |
| Geo | PostGIS | Consultas por proximidad eficientes |
| Tests | Vitest + Testing Library | Mismo motor que Vite |

## Estructura de carpetas

```
src/
├── main.jsx                  Punto de entrada; carga estilos y monta <App/>
├── App.jsx                   Orquesta auth, carga de spots y UI
├── supabaseClient.js         Cliente de Supabase (lee VITE_SUPABASE_*)
├── hooks/
│   └── useGeolocation.js     Observa la ubicación del usuario (watchPosition)
├── lib/
│   └── geo.js                Helpers puros: toPointWKT, paddedRadius
├── components/
│   ├── MapView.jsx           Mapa + marcadores + ViewportLoader + ClickHandler
│   └── AddSpotForm.jsx       Formulario de carga (hoja inferior)
└── test/
    └── setup.js              Setup global de los tests

supabase/
└── schema.sql                Tabla, índice GiST, función RPC y políticas RLS
```

## Modelo de datos

Tabla `trapito_spots`:

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid | PK |
| `geom` | geography(Point,4326) | Punto geográfico; indexado con GiST |
| `lat`, `lng` | double | Copia plana para el frontend |
| `calle` | text | Opcional |
| `descripcion` | text | Opcional |
| `created_by` | uuid | FK a `auth.users` |
| `created_at` | timestamptz | — |
| `status` | text | `activo` por defecto (base para "caducidad" futura) |

### Consulta por proximidad
La función `spots_cercanos(lat, lng, radio_m)` usa `ST_DWithin` sobre la columna
`geom` (geography, en metros) y ordena por cercanía con el operador KNN `<->`.

### Seguridad (RLS)
Row Level Security activado. Políticas:
- **SELECT**: cualquiera lee los `status = 'activo'`.
- **INSERT**: solo `authenticated`, y `created_by` debe ser el propio usuario.
- **UPDATE/DELETE**: solo el autor de la marca.

## Decisiones de diseño

- **Sin backend propio**: Supabase cubre auth, datos y API. Menos a mantener.
- **Login anónimo**: minimiza fricción para empezar a colaborar.
- **Carga por área visible** (no por radio fijo del GPS): muestra siempre lo que
  está en pantalla y funciona aunque el GPS falle.
- **Lógica pura aislada** en `src/lib`: testeable sin React ni red.
