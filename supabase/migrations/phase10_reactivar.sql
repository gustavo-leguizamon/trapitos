-- =============================================================
-- Migración Fase 10 — reactivar marcas caducadas
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 9).
-- Es idempotente.
-- =============================================================

-- 1) spots_cercanos ahora acepta p_incluir_inactivos (para ver los caducados).
--    Los 'oculto' (por abuso) nunca se devuelven.
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

-- 2) Reactivar una marca caducada (solo 'inactivo' -> 'activo'; nunca 'oculto')
create or replace function public.reactivar_trapito(
  p_spot_id uuid,
  p_franjas text[] default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then
    return false;
  end if;

  update public.trapito_spots
  set status = 'activo'
  where id = p_spot_id and status = 'inactivo';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return false;
  end if;

  insert into public.spot_reports (spot_id, user_id, tipo, franjas, created_at)
  values (p_spot_id, v_uid, 'confirma', p_franjas, now())
  on conflict (spot_id, user_id)
  do update set tipo = 'confirma', franjas = excluded.franjas, created_at = now();

  return true;
end;
$$;

grant execute on function public.reactivar_trapito(uuid, text[]) to authenticated;
