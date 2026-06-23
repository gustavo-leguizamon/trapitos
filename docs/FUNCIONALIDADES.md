# Funcionalidades

> **Documento vivo.** Cada vez que se agrega, cambia o elimina una funcionalidad,
> hay que actualizar esta tabla y agregar la entrada correspondiente en
> [`../CHANGELOG.md`](../CHANGELOG.md).

## Estado actual (MVP)

| # | Funcionalidad | Descripción | Estado | Test que la cubre |
|---|---------------|-------------|--------|-------------------|
| 1 | Ver mapa | Mapa Leaflet/OpenStreetMap a pantalla completa | ✅ | — (integración manual) |
| 2 | Geolocalización | Detecta la ubicación del usuario por GPS y la muestra como punto azul | ✅ | `src/hooks/useGeolocation.test.js` |
| 3 | Cargar trapitos visibles | Trae del backend los trapitos dentro del área visible del mapa (al mover/zoomear) | ✅ | `src/lib/geo.test.js` (radio) |
| 4 | Marcar un trapito | Tocando el mapa o con el botón ＋ (posición GPS); se completa calle + detalle | ✅ | `src/components/AddSpotForm.test.jsx` |
| 5 | Login anónimo | Participar sin crear cuenta (Supabase Anonymous Auth) | ✅ | — (integración manual) |
| 6 | Seguridad (RLS) | Cualquiera lee; solo autenticados crean; cada uno edita lo suyo | ✅ | — (definido en `supabase/schema.sql`) |

## Detalle del flujo

### Marcar un trapito
1. El usuario toca el mapa (o el botón ＋, que usa su GPS).
2. Se abre una hoja inferior (`AddSpotForm`) con calle y detalle opcional.
3. Al guardar, se inserta en `trapito_spots` con el punto en formato WKT
   (`toPointWKT` en `src/lib/geo.js`) y el `created_by` del usuario logueado.
4. Se recargan los trapitos del área visible.

### Carga por área visible
- En vez de un radio fijo alrededor del usuario, se consulta el área que se está
  mirando. Cada vez que el mapa se mueve o zoomea, `ViewportLoader` calcula el
  centro y el radio visible y llama a la función `spots_cercanos` de Supabase.
- El radio se agranda un 20% (`paddedRadius`) para incluir lo que está justo en el borde.

## Funcionalidades planificadas (no implementadas)

| Fase | Funcionalidad | Notas |
|------|---------------|-------|
| 2 | Confirmar / "Ya no está" | Votos de la comunidad sobre cada trapito |
| 2 | Score de confianza | Atenuar marcas con muchos desmentidos |
| 2 | Caducidad de marcas | Las viejas sin actividad se desactivan |
| 3 | Reputación de usuarios | — |
| 3 | Horarios del trapito, fotos | — |
| 3 | Notificaciones por proximidad | — |
| 3 | Moderación / reportes de abuso | — |
