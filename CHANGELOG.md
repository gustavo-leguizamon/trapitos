# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y versionado [SemVer](https://semver.org/lang/es/).

> **Recordatorio:** agregá una entrada acá en el mismo commit en que cambiás una
> funcionalidad, y actualizá [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md).

## [Sin publicar]

### Added
- Documentación del proyecto en `docs/` (arquitectura, funcionalidades, testing).
- Tests con Vitest + Testing Library: `geo`, `useGeolocation`, `AddSpotForm`.
- Hook de pre-commit (Husky) que corre los tests y recuerda actualizar la doc.
- Guía de contribución en `CONTRIBUTING.md`.

### Changed
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
