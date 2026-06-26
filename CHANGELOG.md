# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado [SemVer](https://semver.org/lang/es/).

> **Recordatorio:** agregá una entrada acá en el mismo commit en que cambiás una
> funcionalidad, y actualizá [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md).

## [Sin publicar]

### Changed
- **Marcar solo tocando el mapa:** se quitó el botón flotante ＋ que marcaba el
  trapito en la ubicación GPS. Ahora los trapitos se agregan únicamente tocando
  el mapa; el botón 🎯 (centrar en mi ubicación) se mantiene.

## [0.3.0] — 2026-06-26

### Added
- **PWA instalable:** íconos reales (192/512 + *maskable* para Android + apple-touch
  para iOS), manifiesto completo (id, scope, lang, orientación, categorías) y
  metadatos iOS. Botón **"📲 Instalar"** en la barra que dispara el prompt de
  instalación (`src/hooks/usePwaInstall.js`).

## [0.2.0] — 2026-06-24

### Added
- **Fase 11 — Pintar la cuadra del trapito:** al marcar se detecta la cuadra
  (tramo de calle entre esquinas) desde OpenStreetMap/Overpass y se recorta con
  Turf (`src/lib/street.js`). Los trapitos se dibujan como una línea coloreada
  según la confianza (`levelColor`), en vez de un solo pin. Nueva columna
  `geom_calle` (LineString) y `spots_cercanos` devuelve `calle_geom` (GeoJSON);
  ver `supabase/migrations/phase11_cuadra.sql`. La detección prueba varios
  servidores Overpass con timeout y amplía el radio si no hay calles; si falla,
  se puede reintentar o se marca solo el punto (las marcas viejas siguen como pin).
- **Fase 10 — Reactivar marcas caducadas:** toggle ♻️ que muestra los caducados y
  un botón "Reactivar" en el popup; RPC `reactivar_trapito` (security definer) que
  revive solo `inactivo` → `activo` (nunca `oculto`) y refresca la actividad.
  `spots_cercanos` acepta `p_incluir_inactivos`.
- **Fase 9 — Moderación / reportes de abuso:** botón "⚠️ Reportar" con motivo
  (`src/lib/abuse.js`); tabla `abuse_reports` con RLS y un trigger que oculta el
  trapito (`status = 'oculto'`) al llegar a 3 reportes de usuarios distintos.
- **Fase 8 — Reputación del autor en cada marca:** el popup muestra el nivel de
  quien cargó el trapito. Nueva vista `user_reputation` (fuente única); `spots_cercanos`
  devuelve `autor` y `mi_reputacion` se refactorizó para leer de la vista.
- **Fase 7 — Notificaciones por proximidad:** botón 🔔 que avisa (con la app abierta)
  cuando te acercás a un trapito (`src/lib/proximity.js`,
  `src/hooks/useProximityNotifications.js`); usa histéresis para no repetir avisos.
- **Fase 5/6 — Horarios del trapito:** se eligen una o varias franjas horarias al
  dar de alta y al confirmar (`src/lib/schedule.js`, `FranjaSelector`, columna
  `franjas`); el popup muestra "🕒 Suele estar…" y `spots_cercanos` devuelve
  `horarios` (conteo por franja).
- **Fase 4 — Reputación de usuarios:** badge con el nivel del usuario
  (nuevo/colaborador/confiable/experto) según sus aportes (`src/lib/reputation.js`,
  `ReputationBadge`); función SQL `mi_reputacion` (security definer, sin autovotos).
- **Fase 3 — Caducidad de marcas:** función SQL `expirar_trapitos` que desactiva
  trapitos muy dudosos o sin actividad hace mucho, programable con pg_cron
  (`supabase/migrations/phase3_caducidad*.sql`).
- **Fase 3 — Antigüedad en el popup:** "visto hace N días" y aviso "por caducar"
  (`src/lib/expiry.js`); `spots_cercanos` ahora devuelve `last_activity`.
- Tests nuevos: `expiry` y casos de antigüedad en `SpotPopup`.
- **Fase 2 — Votos de la comunidad:** botones "Confirmo" / "Ya no está" en el
  popup de cada trapito (`SpotPopup`), con un voto por usuario y trapito.
- **Fase 2 — Score de confianza:** nivel confiable / sin confirmar / dudoso según
  los votos (`src/lib/confidence.js`); las marcas dudosas se atenúan en el mapa.
- Tabla `spot_reports` con su RLS y migración `supabase/migrations/phase2_votos_confianza.sql`.
- Tests nuevos: `confidence`, `SpotPopup`.
- Documentación del proyecto en `docs/` (arquitectura, funcionalidades, testing).
- Tests con Vitest + Testing Library: `geo`, `useGeolocation`, `AddSpotForm`.
- Hook de pre-commit (Husky) que corre los tests y recuerda actualizar la doc.
- Guía de contribución en `CONTRIBUTING.md`.

### Changed
- **Formulario de alta más amigable:** la hoja de alta (`AddSpotForm`) ahora tiene
  fondo atenuado, tirador, cierre con `Escape` o tocando afuera, una sola tarjeta de
  "dónde" en la paleta de la app, campos opcionales marcados y mejores áreas táctiles.
  Se **ocultan la latitud y longitud crudas** (no le aportan nada al usuario) y el
  botón "Guardar" queda disponible mientras se detecta la cuadra. La franja actual se
  muestra como insignia "ahora".
- Las franjas horarias ahora se **eligen de a varias** (`FranjaSelector`), tanto al
  confirmar como al **dar de alta** un trapito. La columna `franja` pasó a
  `franjas text[]` (ver `supabase/migrations/phase6_franjas_multiples.sql`).
- La función `spots_cercanos` ahora devuelve también `confirma_count`,
  `desmiente_count`, `last_activity` y `horarios` por trapito (cambia su retorno).
- La lógica geoespacial (`toPointWKT`, `paddedRadius`) se extrajo a `src/lib/geo.js`
  para poder testearla de forma aislada.

### Fixed
- Al tocar "Confirmo" en el popup ya no se abre el formulario de alta (el handler de
  click del mapa ignora los clicks originados dentro de un popup) ni se cierra el
  popup (`closeOnClick=false`), para poder elegir las franjas tranquilo.

## [0.1.0] — MVP

### Added
- Mapa Leaflet/OpenStreetMap a pantalla completa.
- Geolocalización del usuario (punto azul pulsante).
- Carga de trapitos según el área visible del mapa (función `spots_cercanos`).
- Marcado de trapitos tocando el mapa o con el botón ＋ (GPS).
- Login anónimo con Supabase Auth.
- Esquema de base de datos con PostGIS y políticas RLS.
- Configuración PWA (instalable, service worker).
