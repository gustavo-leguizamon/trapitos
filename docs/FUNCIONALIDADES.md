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
| 4 | Marcar un trapito | Tocando el mapa; se completa calle + detalle | ✅ | `src/components/AddSpotForm.test.jsx` |
| 5 | Login anónimo | Participar sin crear cuenta (Supabase Anonymous Auth) | ✅ | — (integración manual) |
| 6 | Seguridad (RLS) | Cualquiera lee; solo autenticados crean; cada uno edita lo suyo | ✅ | — (definido en `supabase/schema.sql`) |
| 7 | Votos de la comunidad | Botones "Confirmo" / "Ya no está" en cada trapito (un voto por usuario, modificable) | ✅ | `src/components/SpotPopup.test.jsx` |
| 8 | Score de confianza | Nivel (confiable / sin confirmar / dudoso) según los votos; las marcas dudosas se atenúan en el mapa | ✅ | `src/lib/confidence.test.js` |
| 9 | Antigüedad de la marca | Muestra "visto hace N días" y avisa "por caducar" cuando se acerca al límite | ✅ | `src/lib/expiry.test.js` |
| 10 | Caducidad automática | Trabajo programado que desactiva trapitos dudosos o sin actividad hace mucho | ✅ | — (función SQL `expirar_trapitos`) |
| 11 | Reputación de usuarios | Badge con tu nivel (nuevo/colaborador/confiable/experto) según tus aportes | ✅ | `src/lib/reputation.test.js`, `src/components/ReputationBadge.test.jsx` |
| 12 | Horarios del trapito | Muestra las franjas en que suele aparecer; se eligen (varias) al confirmar y al dar de alta | ✅ | `src/lib/schedule.test.js`, `src/components/FranjaSelector.test.jsx`, `src/components/SpotPopup.test.jsx` |
| 13 | Notificaciones por proximidad | Avisa (con la app abierta) cuando te acercás a un trapito; se activa con 🔔 | ✅ | `src/lib/proximity.test.js` |
| 14 | Reputación del autor en la marca | El popup muestra el nivel de reputación de quien cargó el trapito | ✅ | `src/components/SpotPopup.test.jsx` |
| 15 | Moderación / reportes de abuso | "⚠️ Reportar" con motivo; al llegar a 3 reportes distintos el trapito se oculta | ✅ | `src/lib/abuse.test.js`, `src/components/SpotPopup.test.jsx` |
| 16 | Reactivar caducados | Toggle ♻️ para ver los caducados y reactivarlos (no los ocultos por abuso) | ✅ | `src/components/SpotPopup.test.jsx` |
| 17 | Instalación PWA | Íconos + manifiesto para instalar en el celular; botón "📲 Instalar" | ✅ | — (verificación manual) |
| 18 | Pintar la cuadra | Detecta la cuadra (OSM/Overpass) y la pinta como línea coloreada por confianza, en vez de un solo punto | ✅ | `src/lib/street.test.js`, `src/lib/geo.test.js`, `src/lib/confidence.test.js` |
| 19 | Anti-abuso de la auth anónima | Límites de uso por usuario y antigüedad mínima de cuenta para las acciones destructivas | ✅ | `src/lib/errors.test.js` (mensajes); límites en `supabase/schema.sql` |

## Detalle del flujo

### Marcar un trapito
1. El usuario toca el mapa en el lugar del trapito.
2. Se abre una hoja inferior (`AddSpotForm`) sobre un fondo atenuado, con tirador y
   cierre por `Escape`/tocando afuera. Tiene calle y detalle (ambos opcionales) y el
   selector de franjas. Muestra la cuadra detectada, pero **no** la latitud/longitud
   crudas (no le aportan nada al usuario).
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
- La función SQL **`expirar_trapitos(dias=90, umbral=3, edad_cuenta='24 hours')`**
  pone en `inactivo` (deja de mostrarse) los trapitos que:
  - acumulan `desmentidos − confirmaciones >= umbral` (muy dudosos), contando solo
    desmentidos de cuentas con al menos `edad_cuenta` de antigüedad (ver Fase 12), **o**
  - no tienen actividad (alta ni votos) hace más de `dias` días.
- Se programa con **pg_cron** para correr a diario (ver
  `supabase/migrations/phase3_caducidad_cron.sql`). Es reversible: cambiar el
  `status` de vuelta a `activo` reactiva la marca.

### Reactivar caducados (Fase 10)
- El toggle **♻️** de la barra activa "ver caducados": `spots_cercanos` recibe
  `p_incluir_inactivos` y devuelve también los `inactivo` (atenuados en el mapa).
  Los `oculto` (por abuso) **nunca** se muestran.
- En el popup de un caducado aparece **"♻️ Reactivar"**. Llama a la RPC
  `reactivar_trapito` (security definer) que pasa el `status` a `activo` **solo si
  estaba `inactivo`** (nunca revive un `oculto`) y registra una confirmación fresca
  del reactivador (refresca la actividad para que no recaduque enseguida).

### Pintar la cuadra del trapito (Fase 11)
- Al marcar un trapito (tocando el mapa), se consulta **OpenStreetMap**
  vía **Overpass** las calles cercanas y se recorta el **tramo entre las dos
  esquinas** más cercanas al punto = la cuadra (`getBlockForPoint` en
  `src/lib/street.js`, con Turf para la geometría). El nombre de la calle se
  autocompleta en el formulario.
- En el mapa, cada trapito se dibuja como una **línea (`Polyline`) coloreada
  según la confianza** (`levelColor`: 🟢 confiable · 🟡 sin confirmar ·
  🔴 dudoso · ⚪ caducado), en lugar de un pin. Las marcas viejas sin cuadra
  siguen mostrándose como pin (respaldo).
- Robustez: prueba **varios servidores Overpass** con timeout, **amplía el radio**
  si no encuentra calles, y permite **reintentar** desde el formulario. El alta
  **espera a que termine la detección** antes de guardar (se puede tocar "Guardar"
  mientras detecta y el guardado aguarda al resultado), para no guardar solo el punto
  por error.
- Persistencia: columna `geom_calle geography(LineString,4326)`; `spots_cercanos`
  devuelve `calle_geom` como GeoJSON. Migración `supabase/migrations/phase11_cuadra.sql`.

### Notificaciones por proximidad (Fase 7)
- Botón 🔔 en la barra superior activa/desactiva los avisos (pide permiso de
  notificaciones y guarda la preferencia en `localStorage`).
- Con los avisos activos, al acercarte a un trapito visible aparece una notificación
  del navegador ("🅿️ Trapito cerca — a unos N m").
- Lógica en `src/lib/proximity.js` (distancia Haversine + histéresis: avisa a 150 m,
  "olvida" el aviso al alejarte más de 300 m, para no repetir). El disparo está en
  `src/hooks/useProximityNotifications.js`.
- **Limitación:** funciona con la app abierta (primer o segundo plano). No hay
  geofencing en background con la app cerrada (no es confiable en una PWA).

### Moderación / reportes de abuso (Fase 9)
- En el popup hay un "⚠️ Reportar" (solo logueado) con motivos: Ofensivo / Falso /
  Spam / Otro (`src/lib/abuse.js`).
- Se guarda en `abuse_reports` (un reporte por usuario y trapito). RLS: cada uno crea
  y ve solo lo suyo (no es público).
- Un **trigger** (security definer) cuenta usuarios distintos **con al menos 24 h de
  antigüedad**: al llegar a **3**, pone el trapito en `status = 'oculto'` y deja de
  mostrarse. Reversible por un admin. El filtro de antigüedad es lo que impide
  ocultar cualquier marca con tres sesiones anónimas recién creadas (ver Fase 12).
- El reporte de una cuenta nueva **igual se guarda** (queda para moderación manual);
  simplemente no dispara el ocultado automático. Como el trigger solo corre al
  reportar, `revisar_reportes_abuso()` repasa a diario las marcas cuyos reportantes
  ya maduraron.

### Anti-abuso de la auth anónima (Fase 12)
El login anónimo es gratis e ilimitado: cualquiera puede abrir cuentas desde el
navegador. RLS define **quién** escribe, pero no **cuánto**, así que la app tenía
tres agujeros: inundar el mapa de marcas, hundir una marca a fuerza de "ya no está"
y —el peor— ocultar cualquier trapito con solo 3 sesiones recién creadas.

**Límites de uso** (triggers `before insert` en la base, imposibles de saltear desde
el cliente):

| Acción | Límite |
|--------|--------|
| Marcar un trapito | 10 por hora · 30 por día · **3 en la primera hora de vida de la cuenta** |
| Marcar un trapito | no dos marcas propias a menos de **25 m** entre sí |
| Votar (Confirmo / Ya no está) | 40 por hora · 15 en la primera hora de la cuenta |
| Reportar abuso | 10 por hora |

La primera marca y el primer voto salen **al instante**: el cupo reducido de la
primera hora acota el daño de una sesión descartable sin romper el flujo de
"Participar y colaborar".

**Antigüedad mínima de cuenta (24 h)** para todo lo que sea destructivo y automático:
ocultar por abuso (Fase 9) y caducar por dudoso (Fase 3). Un ataque Sybil pasa a
costar 24 h de espera por cuenta en vez de un F5. Los votos de cuentas nuevas **sí**
cuentan para el score de confianza que se muestra: es reversible y de bajo impacto.

**En pantalla:** cuando se toca un límite, el mensaje viene escrito desde la base
("Llegaste al límite de 10 marcas por hora…", "Ya marcaste un trapito casi en el
mismo lugar…") y se muestra tal cual, sin prefijo técnico (`src/lib/errors.js`).

**Complemento fuera de la base:** captcha en el login anónimo y límite de sign-ins
por IP, ambos en el Supabase Dashboard (ver README). Eso frena la *creación* de
cuentas; los triggers frenan el *daño* de las que se creen igual.

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
- **Reputación del autor (Fase 8):** `spots_cercanos` devuelve un objeto `autor`
  con los agregados del creador (calculados por la vista `user_reputation`), y el
  popup muestra su nivel ("👤 Cargado por: ⭐ Confiable"). Misma fórmula que la
  reputación propia; `mi_reputacion` también lee de esa vista.

### Horarios del trapito (Fase 5–6)
- Tanto al **dar de alta** un trapito como al hacer **Confirmo**, se pueden **elegir
  varias franjas horarias** (`FranjaSelector`). La franja de la hora actual viene
  marcada con una insignia "ahora" (sugerida). Si no se elige ninguna, se usa la actual.
- Las franjas se guardan como arreglo en `spot_reports.franjas`. Al dar de alta, las
  franjas quedan como una confirmación del creador (no suma reputación).
- Franjas (`src/lib/schedule.js`): 🌙 Madrugada (0–5) · 🌅 Mañana (6–11) ·
  🌇 Tarde (12–18) · 🌃 Noche (19–23).
- `spots_cercanos` devuelve `horarios` (jsonb con el conteo por franja; una
  confirmación suma a todas sus franjas) y el popup muestra
  *"🕒 Suele estar: 🌇 Tarde (4) · 🌅 Mañana (1)"*, ordenado por cantidad.

## Funcionalidades planificadas (no implementadas)

| Fase | Funcionalidad | Notas |
|------|---------------|-------|
| 4 | Reputación del autor en cada marca | Mostrar el nivel de quien la cargó (hoy solo se muestra la propia) |
| 4 | Horarios del trapito, fotos | — |
| 4 | Notificaciones por proximidad | — |
| 4 | Moderación / reportes de abuso | — |
| 4 | Reactivar marcas caducadas | Hoy las inactivas no se muestran, así que no se pueden volver a confirmar |
