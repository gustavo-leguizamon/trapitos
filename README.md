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
   Esto crea la tabla `trapito_spots`, la función `spots_cercanos` y las políticas de seguridad (RLS).
3. Activá el login anónimo: **Authentication > Sign In / Providers > Anonymous** → habilitar.

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
