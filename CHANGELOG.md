# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado [SemVer](https://semver.org/lang/es/).

> **Recordatorio:** agregá una entrada acá en el mismo commit en que cambiás una
> funcionalidad, y actualizá [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md).

## [Sin publicar]

### Added
- **Fase 5 — Horarios del trapito:** al confirmar se registra la franja horaria
  (`src/lib/schedule.js`, columna `franja`); el popup muestra "🕒 Suele estar…"
  y `spots_cercanos` devuelve `horarios` (conteo por franja).
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
- Al confirmar, el usuario ahora **elige la franja horaria** en un selector (con la
  hora actual sugerida) en lugar de tomarse siempre automáticamente del reloj.
- La función `spots_cercanos` ahora devuelve también `confirma_count`,
  `desmiente_count`, `last_activity` y `horarios` por trapito (cambia su retorno).
- La lógica geoespacial (`toPointWKT`, `paddedRadius`) se extrajo a `src/lib/geo.js`
  para poder testearla de forma aislada.

## [0.1.0] — MVP

### Added
- Mapa Leaflet/OpenStreetMap a pantalla completa.
- Geolocalización del usuario (punto azul pulsante).
- Carga de trapitos según el área visible del mapa (función `spots_cercanos`).
- Marcado de trapitos tocando el mapa o con el botón ＋ (GPS).
- Login anónimo con Supabase Auth.
- Esquema de base de datos con PostGIS y políticas RLS.
- Configuración PWA (instalable, service worker).
