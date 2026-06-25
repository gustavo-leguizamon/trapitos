-- =============================================================
-- Migración Fase 3 — caducidad de marcas
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 2).
-- Es idempotente. La programación automática está en el archivo
-- phase3_caducidad_cron.sql (opcional, requiere pg_cron).
-- =============================================================

-- 1) spots_cercanos ahora también devuelve last_activity (alta o último voto)
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

-- 2) Función de caducidad: desactiva trapitos dudosos o sin actividad
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

-- Función de mantenimiento: que no la invoquen los clientes
revoke execute on function public.expirar_trapitos(integer, integer) from anon, authenticated;

-- Probarla a mano (devuelve cuántas marcas desactivó):
--   select public.expirar_trapitos();
