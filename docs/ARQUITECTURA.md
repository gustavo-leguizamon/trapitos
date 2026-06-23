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
│   ├── geo.js                Helpers puros: toPointWKT, paddedRadius
│   ├── confidence.js         Score y nivel de confianza a partir de votos
│   ├── expiry.js             Antigüedad / "por caducar" de una marca
│   └── reputation.js         Puntaje y nivel de reputación del usuario
├── components/
│   ├── MapView.jsx           Mapa + marcadores + ViewportLoader + ClickHandler
│   ├── AddSpotForm.jsx       Formulario de carga (hoja inferior)
│   ├── SpotPopup.jsx         Popup de un trapito: votos, confianza, antigüedad
│   └── ReputationBadge.jsx   Badge con la reputación del usuario logueado
└── test/
    └── setup.js              Setup global de los tests

supabase/
├── schema.sql                Esquema completo (canónico): tablas, RPC y RLS
└── migrations/
    ├── phase2_votos_confianza.sql  Cambios de la Fase 2 para una base existente
    ├── phase3_caducidad.sql        Fase 3: last_activity + expirar_trapitos
    ├── phase3_caducidad_cron.sql   Fase 3: programación con pg_cron (opcional)
    └── phase4_reputacion.sql       Fase 4: función mi_reputacion
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

Tabla `spot_reports` (votos de la comunidad — Fase 2):

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid | PK |
| `spot_id` | uuid | FK a `trapito_spots` (on delete cascade) |
| `user_id` | uuid | FK a `auth.users` |
| `tipo` | text | `confirma` o `desmiente` |
| `created_at` | timestamptz | — |
| — | unique | `(spot_id, user_id)`: un voto por usuario y trapito |

### Consulta por proximidad
La función `spots_cercanos(lat, lng, radio_m)` usa `ST_DWithin` sobre la columna
`geom` (geography, en metros) y ordena por cercanía con el operador KNN `<->`.
Hace `left join` con `spot_reports` y devuelve por cada trapito los conteos
`confirma_count` y `desmiente_count` (para el score de confianza) y `last_activity`
(alta o último voto, para la antigüedad/caducidad).

### Caducidad de marcas
La función `expirar_trapitos(dias_inactividad, umbral_dudoso)` pone en `inactivo`
los trapitos muy dudosos o sin actividad hace mucho, y devuelve cuántos desactivó.
Está pensada para ejecutarse de forma programada con **pg_cron** (a diario). El
`execute` está revocado de `anon`/`authenticated`: es una tarea de mantenimiento.

### Reputación de usuarios
La función `mi_reputacion()` es **security definer** con `search_path` fijo: puede
contar todas las marcas/votos del usuario (incluso inactivas) pero está acotada a
`auth.uid()`, por lo que no expone datos de terceros. Excluye los autovotos. El
puntaje y el nivel se calculan en el front (`src/lib/reputation.js`).

### Seguridad (RLS)
Row Level Security activado en ambas tablas.

`trapito_spots`:
- **SELECT**: cualquiera lee los `status = 'activo'`.
- **INSERT**: solo `authenticated`, y `created_by` debe ser el propio usuario.
- **UPDATE/DELETE**: solo el autor de la marca.

`spot_reports`:
- **SELECT**: pública (para mostrar los conteos).
- **INSERT/UPDATE/DELETE**: solo `authenticated`, y solo sobre el propio voto (`user_id = auth.uid()`).

## Decisiones de diseño

- **Sin backend propio**: Supabase cubre auth, datos y API. Menos a mantener.
- **Login anónimo**: minimiza fricción para empezar a colaborar.
- **Carga por área visible** (no por radio fijo del GPS): muestra siempre lo que
  está en pantalla y funciona aunque el GPS falle.
- **Lógica pura aislada** en `src/lib`: testeable sin React ni red.
