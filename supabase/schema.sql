-- =============================================================
-- Trapitos — esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =============================================================

-- Extensión geoespacial para consultas por proximidad ("¿qué hay cerca?")
create extension if not exists postgis;

-- -------------------------------------------------------------
-- Tabla principal: ubicaciones de trapitos
-- -------------------------------------------------------------
create table if not exists public.trapito_spots (
  id          uuid primary key default gen_random_uuid(),
  -- geom guarda lat/lng como un punto geográfico (SRID 4326 = WGS84/GPS)
  geom        geography(Point, 4326) not null,
  lat         double precision not null,
  lng         double precision not null,
  calle       text,
  descripcion text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- 'activo' por defecto; se puede "enfriar" en fases futuras
  status      text not null default 'activo'
);

-- Índice geoespacial para que las consultas por radio sean rápidas
create index if not exists trapito_spots_geom_idx
  on public.trapito_spots using gist (geom);

-- -------------------------------------------------------------
-- RPC: traer trapitos dentro de un radio (en metros) de un punto
-- Se llama desde el frontend con supabase.rpc('spots_cercanos', {...})
-- -------------------------------------------------------------
create or replace function public.spots_cercanos(
  p_lat double precision,
  p_lng double precision,
  p_radio_m double precision default 2000
)
returns setof public.trapito_spots
language sql
stable
as $$
  select *
  from public.trapito_spots
  where status = 'activo'
    and st_dwithin(
      geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radio_m
    )
  order by geom <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit 500;
$$;

-- -------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- -------------------------------------------------------------
alter table public.trapito_spots enable row level security;

-- Cualquiera (incluso anónimo) puede LEER los trapitos activos
create policy "lectura publica de spots activos"
  on public.trapito_spots
  for select
  using (status = 'activo');

-- Solo usuarios autenticados pueden CREAR, y queda registrado quién fue
create policy "usuarios autenticados pueden crear"
  on public.trapito_spots
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Cada usuario puede editar/borrar solo sus propias marcas
create policy "el autor puede modificar lo suyo"
  on public.trapito_spots
  for update
  to authenticated
  using (auth.uid() = created_by);

create policy "el autor puede borrar lo suyo"
  on public.trapito_spots
  for delete
  to authenticated
  using (auth.uid() = created_by);
