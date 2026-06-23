-- =============================================================
-- Migración Fase 5 — horarios del trapito
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 4).
-- Es idempotente.
-- =============================================================

-- 1) Franja horaria del avistaje en cada confirmación
alter table public.spot_reports
  add column if not exists franja text
  check (franja in ('madrugada', 'manana', 'tarde', 'noche'));

-- 2) spots_cercanos ahora también devuelve `horarios` (conteo por franja)
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
      'madrugada', nullif(count(*) filter (where r.tipo = 'confirma' and r.franja = 'madrugada'), 0),
      'manana',    nullif(count(*) filter (where r.tipo = 'confirma' and r.franja = 'manana'), 0),
      'tarde',     nullif(count(*) filter (where r.tipo = 'confirma' and r.franja = 'tarde'), 0),
      'noche',     nullif(count(*) filter (where r.tipo = 'confirma' and r.franja = 'noche'), 0)
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
