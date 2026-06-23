# Funcionalidades

> **Documento vivo.** Cada vez que se agrega, cambia o elimina una funcionalidad,
> hay que actualizar esta tabla y agregar la entrada correspondiente en
> [`../CHANGELOG.md`](../CHANGELOG.md).

## Estado actual

| # | Funcionalidad | Descripción | Estado | Test que la cubre |
|---|---------------|-------------|--------|-------------------|
| 1 | Ver mapa | Mapa Leaflet/OpenStreetMap a pantalla completa | ✅ | — (integración manual) |
| 2 | Geolocalización | Detecta la ubicación del usuario por GPS y la muestra como punto azul | ✅ | `src/hooks/useGeolocation.test.js` |
| 3 | Cargar trapitos visibles | Trae del backend los trapitos dentro del área visible del mapa (al mover/zoomear) | ✅ | `src/lib/geo.test.js` (radio) |
| 4 | Marcar un trapito | Tocando el mapa o con el botón ＋ (posición GPS); se completa calle + detalle | ✅ | `src/components/AddSpotForm.test.jsx` |
| 5 | Login anónimo | Participar sin crear cuenta (Supabase Anonymous Auth) | ✅ | — (integración manual) |
| 6 | Seguridad (RLS) | Cualquiera lee; solo autenticados crean; cada uno edita lo suyo | ✅ | — (definido en `supabase/schema.sql`) |
| 7 | Votos de la comunidad | Botones "Confirmo" / "Ya no está" en cada trapito (un voto por usuario, modificable) | ✅ | `src/components/SpotPopup.test.jsx` |
| 8 | Score de confianza | Nivel (confiable / sin confirmar / dudoso) según los votos; las marcas dudosas se atenúan en el mapa | ✅ | `src/lib/confidence.test.js` |
| 9 | Antigüedad de la marca | Muestra "visto hace N días" y avisa "por caducar" cuando se acerca al límite | ✅ | `src/lib/expiry.test.js` |
| 10 | Caducidad automática | Trabajo programado que desactiva trapitos dudosos o sin actividad hace mucho | ✅ | — (función SQL `expirar_trapitos`) |
| 11 | Reputación de usuarios | Badge con tu nivel (nuevo/colaborador/confiable/experto) según tus aportes | ✅ | `src/lib/reputation.test.js`, `src/components/ReputationBadge.test.jsx` |
| 12 | Horarios del trapito | Muestra las franjas en que suele aparecer, según las confirmaciones | ✅ | `src/lib/schedule.test.js`, `src/components/SpotPopup.test.jsx` |

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

### Votos y confianza (Fase 2)
1. En el popup de cada trapito hay dos botones: **Confirmo** y **Ya no está**.
2. Al votar se hace un *upsert* en `spot_reports` (un voto por usuario y trapito;
   si ya votó, se reemplaza). Hace falta estar logueado.
3. La función `spots_cercanos` devuelve, además de cada trapito, los conteos
   `confirma_count` y `desmiente_count`.
4. El **score** = confirmaciones − desmentidos (`src/lib/confidence.js`). Según el score:
   - `>= 2` → ✅ Confiable
   - entre medio → 🟡 Sin confirmar
   - `<= -2` → ⚠️ Dudoso (el marcador se atenúa con `levelOpacity`).

### Caducidad de marcas (Fase 3)
- En el popup se muestra la **antigüedad** ("visto hace N días", a partir de
  `last_activity` = alta o último voto) y un aviso **⏳ por caducar** cuando está
  dentro de los últimos 14 días antes del límite (`src/lib/expiry.js`).
- La función SQL **`expirar_trapitos(dias=90, umbral=3)`** pone en `inactivo`
  (deja de mostrarse) los trapitos que:
  - acumulan `desmentidos − confirmaciones >= umbral` (muy dudosos), **o**
  - no tienen actividad (alta ni votos) hace más de `dias` días.
- Se programa con **pg_cron** para correr a diario (ver
  `supabase/migrations/phase3_caducidad_cron.sql`). Es reversible: cambiar el
  `status` de vuelta a `activo` reactiva la marca.

### Reputación de usuarios (Fase 4)
- La función SQL `mi_reputacion()` (security definer, acotada a `auth.uid()`)
  devuelve los agregados del usuario: marcas creadas, confirmaciones y desmentidos
  recibidos en sus marcas, y votos emitidos. **No cuenta los autovotos.**
- El front calcula el puntaje con pesos (`src/lib/reputation.js`):
  `+2` por marca creada, `+3` por confirmación recibida, `-2` por desmentido
  recibido, `+1` por voto emitido.
- Niveles por puntaje: `🌱 Nuevo` (<5) · `🙂 Colaborador` (5–19) ·
  `⭐ Confiable` (20–49) · `🏆 Experto` (≥50). Se muestra como badge en la barra
  superior y se refresca al cargar o votar.

### Horarios del trapito (Fase 5)
- Al **Confirmo**, se registra automáticamente la **franja horaria** según el reloj
  del dispositivo (`franja` en `spot_reports`), sin clicks extra.
- Franjas (`src/lib/schedule.js`): 🌙 Madrugada (0–5) · 🌅 Mañana (6–11) ·
  🌇 Tarde (12–18) · 🌃 Noche (19–23).
- `spots_cercanos` devuelve `horarios` (jsonb con el conteo por franja) y el popup
  muestra *"🕒 Suele estar: 🌇 Tarde (4) · 🌅 Mañana (1)"*, ordenado por cantidad.

## Funcionalidades planificadas (no implementadas)

| Fase | Funcionalidad | Notas |
|------|---------------|-------|
| 4 | Reputación del autor en cada marca | Mostrar el nivel de quien la cargó (hoy solo se muestra la propia) |
| 4 | Horarios del trapito, fotos | — |
| 4 | Notificaciones por proximidad | — |
| 4 | Moderación / reportes de abuso | — |
| 4 | Reactivar marcas caducadas | Hoy las inactivas no se muestran, así que no se pueden volver a confirmar |
