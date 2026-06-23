-- =============================================================
-- Migración Fase 2 — votos de la comunidad y score de confianza
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base que ya
-- tiene el esquema de la Fase 1). Es idempotente: se puede correr de nuevo.
-- =============================================================

-- 1) Tabla de votos: un voto por usuario y trapito (puede cambiarlo)
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

-- 2) Reemplazo de la función para incluir el conteo de votos
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
  desmiente_count bigint
)
language sql
stable
as $$
  select
    s.id, s.lat, s.lng, s.calle, s.descripcion, s.status, s.created_at,
    count(r.*) filter (where r.tipo = 'confirma')  as confirma_count,
    count(r.*) filter (where r.tipo = 'desmiente') as desmiente_count
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

-- 3) Seguridad (RLS) para los votos
alter table public.spot_reports enable row level security;

drop policy if exists "lectura publica de votos" on public.spot_reports;
create policy "lectura publica de votos"
  on public.spot_reports for select using (true);

drop policy if exists "usuarios autenticados votan" on public.spot_reports;
create policy "usuarios autenticados votan"
  on public.spot_reports for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "el votante actualiza su voto" on public.spot_reports;
create policy "el votante actualiza su voto"
  on public.spot_reports for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "el votante borra su voto" on public.spot_reports;
create policy "el votante borra su voto"
  on public.spot_reports for delete to authenticated
  using (auth.uid() = user_id);
