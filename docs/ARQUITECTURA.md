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
│   ├── useGeolocation.js     Observa la ubicación del usuario (watchPosition)
│   └── useProximityNotifications.js  Avisos al acercarse a un trapito
├── lib/
│   ├── geo.js                Helpers puros: toPointWKT, paddedRadius
│   ├── confidence.js         Score y nivel de confianza a partir de votos
│   ├── expiry.js             Antigüedad / "por caducar" de una marca
│   ├── reputation.js         Puntaje y nivel de reputación del usuario
│   ├── schedule.js           Franjas horarias del trapito
│   ├── proximity.js          Distancia y alertas de proximidad
│   └── errors.js             Errores de Supabase → mensaje para el usuario
├── components/
│   ├── MapView.jsx           Mapa + marcadores + ViewportLoader + ClickHandler
│   ├── AddSpotForm.jsx       Formulario de carga (hoja inferior)
│   ├── SpotPopup.jsx         Popup de un trapito: votos, confianza, antigüedad
│   ├── FranjaSelector.jsx    Selector múltiple de franjas (alta y confirmación)
│   └── ReputationBadge.jsx   Badge con la reputación del usuario logueado
└── test/
    └── setup.js              Setup global de los tests

supabase/
├── schema.sql                Esquema completo (canónico): tablas, RPC y RLS
└── migrations/
    ├── phase2_votos_confianza.sql  Cambios de la Fase 2 para una base existente
    ├── phase3_caducidad.sql        Fase 3: last_activity + expirar_trapitos
    ├── phase3_caducidad_cron.sql   Fase 3: programación con pg_cron (opcional)
    ├── phase4_reputacion.sql       Fase 4: función mi_reputacion
    ├── phase5_horarios.sql         Fase 5: franja + horarios en spots_cercanos
    ├── phase6_franjas_multiples.sql Fase 6: franja -> franjas text[] (varias)
    ├── phase8_autor_reputacion.sql Fase 8: vista user_reputation + autor en spots
    ├── phase9_moderacion.sql       Fase 9: abuse_reports + trigger de ocultado
    ├── phase10_reactivar.sql       Fase 10: incluir inactivos + reactivar_trapito
    ├── phase11_cuadra.sql          Fase 11: geom_calle + calle_geom en spots_cercanos
    ├── phase12_antiabuso.sql       Fase 12: límites de uso y antigüedad de cuenta
    └── phase12_antiabuso_cron.sql  Fase 12: repaso diario de reportes (opcional)
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
| `franjas` | text[] | franjas horarias del avistaje (solo en confirmaciones; varias) |
| `created_at` | timestamptz | — |
| — | unique | `(spot_id, user_id)`: un voto por usuario y trapito |

Tabla `abuse_reports` (moderación — Fase 9):

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid | PK |
| `spot_id` | uuid | FK a `trapito_spots` |
| `user_id` | uuid | FK a `auth.users` |
| `motivo` | text | `ofensivo` / `falso` / `spam` / `otro` |
| `created_at` | timestamptz | — |
| — | unique | `(spot_id, user_id)`: un reporte por usuario y trapito |

Un trigger (`check_abuse_threshold`, security definer) oculta el trapito
(`status = 'oculto'`) al llegar a 3 usuarios distintos que lo reportaron.

### Consulta por proximidad
La función `spots_cercanos(lat, lng, radio_m)` usa `ST_DWithin` sobre la columna
`geom` (geography, en metros) y ordena por cercanía con el operador KNN `<->`.
Hace `left join` con `spot_reports` y devuelve por cada trapito los conteos
`confirma_count` y `desmiente_count` (para el score de confianza), `last_activity`
(alta o último voto, para la antigüedad/caducidad) y `horarios` (jsonb con el
conteo de confirmaciones por franja horaria).

### Caducidad de marcas
La función `expirar_trapitos(dias_inactividad, umbral_dudoso, edad_min_cuenta)` pone
en `inactivo` los trapitos muy dudosos (contando solo desmentidos de cuentas con
antigüedad, ver anti-abuso) o sin actividad hace mucho, y devuelve cuántos desactivó.
Está pensada para ejecutarse de forma programada con **pg_cron** (a diario). El
`execute` está revocado de `anon`/`authenticated`: es una tarea de mantenimiento.

La función `reactivar_trapito(spot_id, franjas)` (security definer) hace lo inverso:
pasa un trapito `inactivo` a `activo` (nunca un `oculto`) y registra una confirmación
fresca. `spots_cercanos` acepta `p_incluir_inactivos` para mostrar los caducados.

### Reputación de usuarios
La vista `user_reputation` agrega por usuario (marcas creadas, confirmaciones y
desmentidos recibidos —sin autovotos— y votos emitidos). En PG15 corre con permisos
del dueño, así que ve todo sin chocar con RLS. Es la **fuente única**:
- `mi_reputacion()` (security definer) la filtra por `auth.uid()` para tu badge.
- `spots_cercanos` la une por `created_by` y devuelve el objeto `autor` por marca.
El puntaje y el nivel se calculan en el front (`src/lib/reputation.js`).

### Seguridad (RLS)
Row Level Security activado en ambas tablas.

`trapito_spots`:
- **SELECT**: cualquiera lee los `status = 'activo'`.
- **INSERT**: solo `authenticated`, y `created_by` debe ser el propio usuario.
- **UPDATE/DELETE**: solo el autor de la marca.

`spot_reports`:
- **SELECT**: pública (para mostrar los conteos).
- **INSERT/UPDATE/DELETE**: solo `authenticated`, y solo sobre el propio voto (`user_id = auth.uid()`).

`abuse_reports`:
- **SELECT/INSERT/UPDATE**: solo `authenticated` y solo sobre el propio reporte. No es público.

### Anti-abuso de la auth anónima (Fase 12)
El login anónimo no cuesta nada: cualquiera puede crear usuarios ilimitados desde
el navegador, así que **la identidad no sirve como control**. RLS dice *quién*
puede escribir; hace falta además limitar *cuánto*. Se resuelve entero en la base
(triggers `before insert`), porque no hay backend propio donde ponerlo y el
cliente es público:

| Acción | Límite |
|--------|--------|
| Crear trapito | 10 por hora · 30 por día · **3 en la primera hora de vida de la cuenta** |
| Crear trapito | no dos marcas propias a menos de **25 m** (anti-*dump* en la misma cuadra) |
| Votar (`spot_reports`) | 40 por hora · 15 en la primera hora de la cuenta |
| Reportar abuso | 10 por hora |

El criterio de fondo: **la primera marca y el primer voto salen al instante** (no
se rompe la UX de "Participar y colaborar"), pero una sesión anónima descartable
tiene un techo bajo.

Aparte, las acciones **destructivas y automáticas** exigen que la cuenta tenga al
menos **24 h** de antigüedad para computar:
- `check_abuse_threshold`: ocultar pide 3 usuarios distintos **maduros**. Antes,
  3 sesiones anónimas recién creadas bajaban cualquier marca.
- `expirar_trapitos`: el criterio "muy dudoso" solo cuenta desmentidos de cuentas
  maduras (el criterio por inactividad no cambia).
- Los votos de cuentas nuevas **sí** cuentan para el score de confianza que se
  muestra en el mapa: es reversible y de bajo impacto.

Como el trigger de abuso solo corre al llegar un reporte, `revisar_reportes_abuso()`
repasa a diario las marcas con reportes de cuentas que ya maduraron
(`phase12_antiabuso_cron.sql`, junto a la caducidad).

Los límites se avisan con SQLSTATE `PT429` / `PT409`: PostgREST los traduce a
HTTP 429 / 409 y `src/lib/errors.js` muestra el mensaje de la base tal cual, sin
prefijo técnico.

**Fuera de la base** (Supabase Dashboard, ver README): captcha en el login anónimo
y límite de sign-ins por IP. Eso frena la *creación* de cuentas; los triggers
frenan el *daño* de las que se creen igual.

## Decisiones de diseño

- **Sin backend propio**: Supabase cubre auth, datos y API. Menos a mantener.
- **Login anónimo**: minimiza fricción para empezar a colaborar.
- **Carga por área visible** (no por radio fijo del GPS): muestra siempre lo que
  está en pantalla y funciona aunque el GPS falle.
- **Lógica pura aislada** en `src/lib`: testeable sin React ni red.
- **Los límites anti-abuso viven en la base** (triggers): sin backend propio, es
  el único lugar donde el cliente no los puede saltear.
