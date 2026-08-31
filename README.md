# 🅿️ Trapitos

Mapa colaborativo para marcar ubicaciones de **trapitos** (cuidacoches) en la vía pública.
PWA construida con React + Vite, mapas con Leaflet/OpenStreetMap y backend en Supabase.

## Cómo funciona

- Ves un mapa centrado en tu ubicación con los trapitos cercanos.
- Marcás uno tocando el mapa o usando el botón ＋ (tu posición GPS).
- Para cargar necesitás "Participar" (login anónimo de Supabase, sin crear cuenta).
- Cualquiera puede leer; solo usuarios autenticados pueden cargar.

## Puesta en marcha

### 1. Crear el proyecto de Supabase

1. Creá un proyecto gratis en [supabase.com](https://supabase.com).
2. Andá a **SQL Editor** y ejecutá el contenido de [`supabase/schema.sql`](supabase/schema.sql).
   Esto crea la tabla `trapito_spots`, la función `spots_cercanos`, las políticas de
   seguridad (RLS) y los límites anti-abuso.
3. Activá el login anónimo: **Authentication > Sign In / Providers > Anonymous** → habilitar.

### 1.b Proteger el login anónimo (recomendado)

El login anónimo no cuesta nada de crear: sin esto, cualquiera puede abrir miles de
cuentas desde el navegador. Los límites de uso ya están en la base (ver
[anti-abuso](docs/FUNCIONALIDADES.md#anti-abuso-de-la-auth-anónima-fase-12)), pero
conviene frenar también la **creación** de cuentas, que se configura en el Dashboard:

1. **Captcha (Cloudflare Turnstile).** Ya está cableado en la app y es opcional:
   se activa solo si definís `VITE_TURNSTILE_SITE_KEY`. Es invisible salvo que
   Cloudflare decida desafiar a quien esté del otro lado.

   1. Creá un widget en [Cloudflare Turnstile](https://dash.cloudflare.com) →
      te da una **site key** (pública) y una **secret key** (privada).
   2. Poné la **site key** en tu `.env` (y en las variables de entorno de Vercel)
      y **desplegá**:
      ```
      VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
      ```
   3. Recién después, cargá la **secret key** en Supabase: **Authentication >
      Settings > Bot and Abuse Protection** → activar *Turnstile by Cloudflare*.

   > El orden importa. Mandar el token de más es inofensivo (Supabase lo ignora
   > mientras el captcha esté apagado), pero al revés el login anónimo queda roto
   > hasta el deploy: Supabase pide un token que la app todavía no manda.
   > Sin la variable, la app funciona igual que siempre: `getToken()` devuelve
   > `null` y el sign-in va derecho.
2. **Límite por IP:** **Authentication > Rate Limits** → bajar *anonymous sign-ins*
   (por defecto 30/hora por IP) a lo que necesite tu tráfico real.
3. **Limpieza:** las cuentas anónimas quedan en `auth.users` para siempre. Supabase
   sugiere borrar periódicamente las que no dejaron nada:

   ```sql
   delete from auth.users
   where is_anonymous is true
     and created_at < now() - interval '30 days'
     and id not in (select created_by from public.trapito_spots where created_by is not null)
     and id not in (select user_id from public.spot_reports)
     and id not in (select user_id from public.abuse_reports);
   ```

   > Los votos y reportes son `on delete cascade`: borrar un usuario que aportó
   > algo se llevaría su historial, por eso las tres exclusiones.

### 1.c Programar las tareas de mantenimiento (opcional)

Ejecutá [`supabase/migrations/phase3_caducidad_cron.sql`](supabase/migrations/phase3_caducidad_cron.sql)
y [`supabase/migrations/phase12_antiabuso_cron.sql`](supabase/migrations/phase12_antiabuso_cron.sql)
para que **pg_cron** corra a diario la caducidad de marcas y el repaso de reportes de abuso.

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Completá `.env` con los datos de **Project Settings > API**:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

### 3. Correr la app

```bash
npm install
npm run dev      # desarrollo en http://localhost:5173
npm run build    # build de producción
npm run preview  # previsualizar el build
```

> La geolocalización del navegador requiere **HTTPS** (o `localhost`). En producción
> serví la app por HTTPS para que funcione el GPS.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Stack, estructura, modelo de datos, decisiones de diseño |
| [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md) | Qué hace la app (documento vivo) y roadmap |
| [`docs/TESTING.md`](docs/TESTING.md) | Cómo correr y escribir tests |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Flujo de trabajo y qué pasa en cada commit |
| [`CHANGELOG.md`](CHANGELOG.md) | Registro de cambios |

## Tests e integridad

```bash
npm test           # tests en modo watch
npm run test:run   # corre los tests una vez
```

En cada commit, un hook de **Husky** corre todos los tests (aborta el commit si
alguno falla) y recuerda actualizar la documentación. Ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Próximas fases (no incluidas en el MVP)

- **Calidad colaborativa:** botones "Confirmo / Ya no está" y score de confianza.
- **Caducidad:** marcas viejas sin actividad se atenúan o desactivan.
- **Comunidad:** reputación de usuarios, horarios del trapito, fotos, notificaciones por proximidad.
- **Moderación:** reportes de abuso y panel de administración.

## PWA / instalación

La app es instalable (manifiesto + service worker). Los íconos viven en `public/`
y se generan con:

```bash
npm run icons   # regenera los PNG desde scripts/generate-icons.mjs (usa sharp)
```

La instalación requiere **HTTPS** (en producción lo da Vercel). En Android/desktop
aparece el botón **"📲 Instalar"**; en iOS se usa **Compartir → Agregar a inicio**.
