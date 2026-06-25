-- =============================================================
-- Migración Fase 8 — reputación del autor visible en cada marca
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 6).
-- Es idempotente.
-- =============================================================

-- 1) Vista de agregados de reputación por usuario (fuente única).
--    En PG15 corre con permisos del dueño => ve todo, sin chocar con RLS.
create or replace view public.user_reputation as
with creados as (
  select
    s.created_by as user_id,
    count(distinct s.id)                                                       as spots_creados,
    count(*) filter (where r.tipo = 'confirma'  and r.user_id <> s.created_by) as confirmaciones_recibidas,
    count(*) filter (where r.tipo = 'desmiente' and r.user_id <> s.created_by) as desmentidos_recibidos
  from public.trapito_spots s
  left join public.spot_reports r on r.spot_id = s.id
  where s.created_by is not null
  group by s.created_by
),
emitidos as (
  select user_id, count(*) as votos_emitidos
  from public.spot_reports
  group by user_id
)
select
  coalesce(c.user_id, e.user_id)          as user_id,
  coalesce(c.spots_creados, 0)            as spots_creados,
  coalesce(c.confirmaciones_recibidas, 0) as confirmaciones_recibidas,
  coalesce(c.desmentidos_recibidos, 0)    as desmentidos_recibidos,
  coalesce(e.votos_emitidos, 0)           as votos_emitidos
from creados c
full outer join emitidos e on e.user_id = c.user_id;

grant select on public.user_reputation to anon, authenticated;

-- 2) spots_cercanos ahora también devuelve `autor` (agregados de reputación)
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
  horarios        jsonb,
  autor           jsonb
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
    )) as horarios,
    case when s.created_by is null then null else jsonb_build_object(
      'spotsCreados',            coalesce(ur.spots_creados, 0),
      'confirmacionesRecibidas', coalesce(ur.confirmaciones_recibidas, 0),
      'desmentidosRecibidos',    coalesce(ur.desmentidos_recibidos, 0),
      'votosEmitidos',           coalesce(ur.votos_emitidos, 0)
    ) end as autor
  from public.trapito_spots s
  left join public.spot_reports r on r.spot_id = s.id
  left join public.user_reputation ur on ur.user_id = s.created_by
  where s.status = 'activo'
    and st_dwithin(
      s.geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radio_m
    )
  group by s.id, ur.spots_creados, ur.confirmaciones_recibidas, ur.desmentidos_recibidos, ur.votos_emitidos
  order by s.geom <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit 500;
$$;

-- 3) mi_reputacion ahora lee de la misma vista (consistencia)
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
    coalesce(ur.spots_creados, 0),
    coalesce(ur.confirmaciones_recibidas, 0),
    coalesce(ur.desmentidos_recibidos, 0),
    coalesce(ur.votos_emitidos, 0)
  from (select auth.uid() as uid) me
  left join public.user_reputation ur on ur.user_id = me.uid;
$$;

grant execute on function public.mi_reputacion() to authenticated;
