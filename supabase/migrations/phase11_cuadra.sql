-- =============================================================
-- Migración Fase 11 — geometría de la cuadra
-- Cada trapito puede tener la línea de la cuadra por la que anda
-- (además del punto representativo, que se conserva para proximidad).
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 10).
-- Es idempotente.
-- =============================================================

-- 1) Columna con la geometría de la cuadra (tramo de calle entre esquinas).
--    Nullable: las marcas viejas (solo punto) siguen funcionando.
alter table public.trapito_spots
  add column if not exists geom_calle geography(LineString, 4326);

-- 2) spots_cercanos ahora devuelve también la cuadra como GeoJSON (calle_geom),
--    para que el front la dibuje como polilínea. El resto no cambia.
drop function if exists public.spots_cercanos(double precision, double precision, double precision);
drop function if exists public.spots_cercanos(double precision, double precision, double precision, boolean);

create or replace function public.spots_cercanos(
  p_lat double precision,
  p_lng double precision,
  p_radio_m double precision default 2000,
  p_incluir_inactivos boolean default false
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
  autor           jsonb,
  calle_geom      jsonb
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
    ) end as autor,
    -- La cuadra como GeoJSON (null si la marca es vieja y solo tiene punto)
    st_asgeojson(s.geom_calle)::jsonb as calle_geom
  from public.trapito_spots s
  left join public.spot_reports r on r.spot_id = s.id
  left join public.user_reputation ur on ur.user_id = s.created_by
  where (s.status = 'activo' or (p_incluir_inactivos and s.status = 'inactivo'))
    and st_dwithin(
      s.geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radio_m
    )
  group by s.id, ur.spots_creados, ur.confirmaciones_recibidas, ur.desmentidos_recibidos, ur.votos_emitidos
  order by s.geom <-> st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  limit 500;
$$;
