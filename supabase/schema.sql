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
-- Votos de la comunidad sobre cada trapito (Fase 2)
-- Un voto por usuario y trapito; puede cambiarlo (upsert).
-- -------------------------------------------------------------
create table if not exists public.spot_reports (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references public.trapito_spots(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('confirma', 'desmiente')),
  created_at timestamptz not null default now(),
  unique (spot_id, user_id)
);

create index if not exists spot_reports_spot_idx
  on public.spot_reports (spot_id);

-- -------------------------------------------------------------
-- RPC: traer trapitos dentro de un radio (en metros) de un punto,
-- junto con el conteo de votos (confirmaciones / desmentidos).
-- Se llama desde el frontend con supabase.rpc('spots_cercanos', {...})
-- -------------------------------------------------------------
-- Se dropea primero porque cambia el tipo de retorno respecto a la Fase 1.
drop function if exists public.spots_cercanos(double precision, double precision, double precision);

create or replace function public.spots_cercanos(
  p_lat double precision,
  p_lng double precision,
  p_radio_m double precision default 2000
)
returns table (
  id              uuid,
  lat             double precision,
  lng             double precision,
  calle           text,
  descripcion     text,
  status          text,
  created_at      timestamptz,
  confirma_count  bigint,
  desmiente_count bigint,
  last_activity   timestamptz
)
language sql
stable
as $$
  select
    s.id, s.lat, s.lng, s.calle, s.descripcion, s.status, s.created_at,
    count(r.*) filter (where r.tipo = 'confirma')  as confirma_count,
    count(r.*) filter (where r.tipo = 'desmiente') as desmiente_count,
    greatest(s.created_at, max(r.created_at))      as last_activity
  from public.trapito_spots s
  left join public.spot_reports r on r.spot_id = s.id
  where s.status = 'activo'
    and st_dwithin(
      s.geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radio_m
    )
  group by s.id
  order by s.geom <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit 500;
$$;

-- -------------------------------------------------------------
-- Caducidad de marcas (Fase 3)
-- Desactiva (status = 'inactivo') los trapitos que:
--   a) acumulan muchos más desmentidos que confirmaciones, o
--   b) no tienen actividad (alta ni votos) hace muchos días.
-- Devuelve cuántos desactivó. Pensada para correr de forma programada (pg_cron).
-- -------------------------------------------------------------
create or replace function public.expirar_trapitos(
  p_dias_inactividad integer default 90,
  p_umbral_dudoso    integer default 3
)
returns integer
language plpgsql
as $$
declare
  v_afectados integer;
begin
  update public.trapito_spots s
  set status = 'inactivo'
  where s.status = 'activo'
    and (
      -- (a) muchos más desmentidos que confirmaciones
      (
        (select count(*) from public.spot_reports r where r.spot_id = s.id and r.tipo = 'desmiente')
        - (select count(*) from public.spot_reports r where r.spot_id = s.id and r.tipo = 'confirma')
      ) >= p_umbral_dudoso
      -- (b) sin actividad (alta ni votos) hace muchos días
      or greatest(
           s.created_at,
           (select max(r.created_at) from public.spot_reports r where r.spot_id = s.id)
         ) < now() - make_interval(days => p_dias_inactividad)
    );
  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;

-- Esta función es de mantenimiento: que no la invoquen los clientes.
revoke execute on function public.expirar_trapitos(integer, integer) from anon, authenticated;

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

-- -------------------------------------------------------------
-- RLS para los votos (spot_reports)
-- -------------------------------------------------------------
alter table public.spot_reports enable row level security;

-- Cualquiera puede LEER los votos (para mostrar los conteos)
create policy "lectura publica de votos"
  on public.spot_reports
  for select
  using (true);

-- Solo usuarios autenticados votan, y el voto queda a su nombre
create policy "usuarios autenticados votan"
  on public.spot_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Cada usuario puede cambiar o borrar su propio voto
create policy "el votante actualiza su voto"
  on public.spot_reports
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "el votante borra su voto"
  on public.spot_reports
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- Reputación del usuario (Fase 4)
-- Agregados del usuario logueado para calcular su reputación en el front.
-- security definer: necesita contar también las marcas inactivas/propias,
-- pero SIEMPRE acotado a auth.uid(), así que no expone datos de terceros.
-- No cuenta los autovotos (confirmar/desmentir las propias marcas).
-- -------------------------------------------------------------
create or replace function public.mi_reputacion()
returns table (
  spots_creados            bigint,
  confirmaciones_recibidas bigint,
  desmentidos_recibidos    bigint,
  votos_emitidos           bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*) from public.trapito_spots s
       where s.created_by = auth.uid()),
    (select count(*) from public.spot_reports r
       join public.trapito_spots s on s.id = r.spot_id
       where s.created_by = auth.uid()
         and r.tipo = 'confirma'
         and r.user_id <> s.created_by),
    (select count(*) from public.spot_reports r
       join public.trapito_spots s on s.id = r.spot_id
       where s.created_by = auth.uid()
         and r.tipo = 'desmiente'
         and r.user_id <> s.created_by),
    (select count(*) from public.spot_reports r
       where r.user_id = auth.uid());
$$;

grant execute on function public.mi_reputacion() to authenticated;
