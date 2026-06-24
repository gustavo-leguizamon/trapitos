-- =============================================================
-- Migración Fase 6 — múltiples franjas por confirmación
-- Convierte spot_reports.franja (un valor) en franjas text[] (varios).
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 5).
-- Es idempotente.
-- =============================================================

-- 1) Nueva columna de arreglo de franjas
alter table public.spot_reports
  add column if not exists franjas text[];

-- 2) Migrar los datos viejos (franja única -> arreglo de un elemento)
update public.spot_reports
set franjas = array[franja]
where franja is not null
  and franjas is null;

-- 3) Eliminar la columna vieja (se lleva su check constraint)
alter table public.spot_reports
  drop column if exists franja;

-- 4) Validez de los elementos del arreglo
alter table public.spot_reports
  drop constraint if exists spot_reports_franjas_validas;
alter table public.spot_reports
  add constraint spot_reports_franjas_validas
  check (franjas is null or franjas <@ array['madrugada', 'manana', 'tarde', 'noche']::text[]);

-- 5) spots_cercanos: contar confirmaciones por franja usando el arreglo
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
  last_activity   timestamptz,
  horarios        jsonb
)
language sql
stable
as $$
  select
    s.id, s.lat, s.lng, s.calle, s.descripcion, s.status, s.created_at,
    count(r.*) filter (where r.tipo = 'confirma')  as confirma_count,
    count(r.*) filter (where r.tipo = 'desmiente') as desmiente_count,
    greatest(s.created_at, max(r.created_at))      as last_activity,
    jsonb_strip_nulls(jsonb_build_object(
      'madrugada', nullif(count(*) filter (where r.tipo = 'confirma' and 'madrugada' = any(r.franjas)), 0),
      'manana',    nullif(count(*) filter (where r.tipo = 'confirma' and 'manana' = any(r.franjas)), 0),
      'tarde',     nullif(count(*) filter (where r.tipo = 'confirma' and 'tarde' = any(r.franjas)), 0),
      'noche',     nullif(count(*) filter (where r.tipo = 'confirma' and 'noche' = any(r.franjas)), 0)
    )) as horarios
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
