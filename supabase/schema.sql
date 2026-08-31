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
  -- geom_calle guarda la cuadra (tramo de calle) por la que anda el trapito.
  -- Nullable: las marcas viejas (solo punto) siguen funcionando.
  geom_calle  geography(LineString, 4326),
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
  -- franjas horarias del avistaje (solo en confirmaciones); para los horarios típicos.
  -- Es un arreglo: una confirmación puede abarcar varias franjas.
  franjas    text[] check (franjas <@ array['madrugada', 'manana', 'tarde', 'noche']::text[]),
  created_at timestamptz not null default now(),
  unique (spot_id, user_id)
);

create index if not exists spot_reports_spot_idx
  on public.spot_reports (spot_id);

-- -------------------------------------------------------------
-- Vista: agregados de reputación por usuario (Fase 8)
-- Base única para la reputación propia (mi_reputacion) y la del autor de cada
-- marca (spots_cercanos). En PG15 la vista corre con permisos del dueño, así que
-- ve todas las filas sin chocar con RLS. No cuenta autovotos.
-- -------------------------------------------------------------
create or replace view public.user_reputation as
with creados as (
  select
    s.created_by as user_id,
    count(distinct s.id)                                                            as spots_creados,
    count(*) filter (where r.tipo = 'confirma'  and r.user_id <> s.created_by)      as confirmaciones_recibidas,
    count(*) filter (where r.tipo = 'desmiente' and r.user_id <> s.created_by)      as desmentidos_recibidos
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
  coalesce(c.user_id, e.user_id)            as user_id,
  coalesce(c.spots_creados, 0)              as spots_creados,
  coalesce(c.confirmaciones_recibidas, 0)   as confirmaciones_recibidas,
  coalesce(c.desmentidos_recibidos, 0)      as desmentidos_recibidos,
  coalesce(e.votos_emitidos, 0)             as votos_emitidos
from creados c
full outer join emitidos e on e.user_id = c.user_id;

grant select on public.user_reputation to anon, authenticated;

-- -------------------------------------------------------------
-- RPC: traer trapitos dentro de un radio (en metros) de un punto,
-- junto con el conteo de votos y la reputación del autor de cada marca.
-- Se llama desde el frontend con supabase.rpc('spots_cercanos', {...})
-- -------------------------------------------------------------
-- Se dropea primero porque cambia el tipo de retorno respecto a la Fase 1.
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
    -- conteo de confirmaciones por franja horaria (solo franjas con datos).
    -- Una confirmación puede sumar a varias franjas (franjas es un arreglo).
    jsonb_strip_nulls(jsonb_build_object(
      'madrugada', nullif(count(*) filter (where r.tipo = 'confirma' and 'madrugada' = any(r.franjas)), 0),
      'manana',    nullif(count(*) filter (where r.tipo = 'confirma' and 'manana' = any(r.franjas)), 0),
      'tarde',     nullif(count(*) filter (where r.tipo = 'confirma' and 'tarde' = any(r.franjas)), 0),
      'noche',     nullif(count(*) filter (where r.tipo = 'confirma' and 'noche' = any(r.franjas)), 0)
    )) as horarios,
    -- agregados de reputación del autor (el front calcula puntaje y nivel)
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
  -- Siempre los activos; los inactivos (caducados) solo si se piden.
  -- Los 'oculto' (por abuso) nunca se devuelven.
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

-- -------------------------------------------------------------
-- Caducidad de marcas (Fase 3, endurecida en Fase 12)
-- Desactiva (status = 'inactivo') los trapitos que:
--   a) acumulan muchos más desmentidos que confirmaciones, o
--   b) no tienen actividad (alta ni votos) hace muchos días.
-- Devuelve cuántos desactivó. Pensada para correr de forma programada (pg_cron).
-- (a) es destructivo, así que solo cuenta desmentidos de cuentas con antigüedad:
-- si no, tres sesiones anónimas recién creadas matan cualquier marca.
-- -------------------------------------------------------------
create or replace function public.expirar_trapitos(
  p_dias_inactividad integer  default 90,
  p_umbral_dudoso    integer  default 3,
  p_edad_min_cuenta  interval default interval '24 hours'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  update public.trapito_spots s
  set status = 'inactivo'
  where s.status = 'activo'
    and (
      -- (a) muchos más desmentidos que confirmaciones (solo cuentas maduras)
      (
        (select count(*) from public.spot_reports r
           join auth.users u on u.id = r.user_id
          where r.spot_id = s.id and r.tipo = 'desmiente'
            and u.created_at <= now() - p_edad_min_cuenta)
        - (select count(*) from public.spot_reports r
             where r.spot_id = s.id and r.tipo = 'confirma')
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

-- Función de mantenimiento: que no la invoquen los clientes. Se revoca también
-- de PUBLIC, que por defecto tiene execute sobre toda función nueva (si no, el
-- revoke a anon/authenticated no alcanza).
revoke execute on function public.expirar_trapitos(integer, integer, interval) from public, anon, authenticated;

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
-- Reputación del usuario (Fase 4, refactor Fase 8)
-- Agregados del usuario logueado, leídos de la vista user_reputation
-- (misma fórmula que para la reputación del autor de cada marca).
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
    coalesce(ur.spots_creados, 0),
    coalesce(ur.confirmaciones_recibidas, 0),
    coalesce(ur.desmentidos_recibidos, 0),
    coalesce(ur.votos_emitidos, 0)
  from (select auth.uid() as uid) me
  left join public.user_reputation ur on ur.user_id = me.uid;
$$;

grant execute on function public.mi_reputacion() to authenticated;

-- -------------------------------------------------------------
-- Moderación: reportes de abuso (Fase 9)
-- Un reporte por usuario y trapito. Al llegar a 3 usuarios distintos, el trapito
-- se oculta (status = 'oculto') y deja de aparecer en spots_cercanos.
-- -------------------------------------------------------------
create table if not exists public.abuse_reports (
  id         uuid primary key default gen_random_uuid(),
  spot_id    uuid not null references public.trapito_spots(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  motivo     text not null check (motivo in ('ofensivo', 'falso', 'spam', 'otro')),
  created_at timestamptz not null default now(),
  unique (spot_id, user_id)
);

create index if not exists abuse_reports_spot_idx
  on public.abuse_reports (spot_id);

-- Umbral de reportes (usuarios distintos) para ocultar un trapito.
-- Fase 12: solo cuentan las cuentas con al menos 24 h de antigüedad. Ocultar es
-- la acción más destructiva que puede disparar un usuario, y sin este filtro
-- tres sesiones anónimas recién creadas bajaban cualquier marca. El reporte de
-- una cuenta nueva igual se guarda (queda para moderación manual).
create or replace function public.check_abuse_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_umbral      constant integer  := 3;
  c_edad_minima constant interval := interval '24 hours';
  v_count integer;
begin
  select count(distinct r.user_id) into v_count
  from public.abuse_reports r
  join auth.users u on u.id = r.user_id
  where r.spot_id = new.spot_id
    and u.created_at <= now() - c_edad_minima;

  if v_count >= c_umbral then
    update public.trapito_spots
    set status = 'oculto'
    where id = new.spot_id and status = 'activo';
  end if;
  return new;
end;
$$;

-- El trigger solo corre al reportar. Si tres cuentas reportaron cuando todavía
-- eran nuevas, nadie vuelve a evaluar esa marca: esta función repasa todo y se
-- programa a diario (supabase/migrations/phase12_antiabuso_cron.sql).
create or replace function public.revisar_reportes_abuso(
  p_umbral      integer  default 3,
  p_edad_minima interval default interval '24 hours'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  update public.trapito_spots s
  set status = 'oculto'
  where s.status = 'activo'
    and (
      select count(distinct r.user_id)
      from public.abuse_reports r
      join auth.users u on u.id = r.user_id
      where r.spot_id = s.id
        and u.created_at <= now() - p_edad_minima
    ) >= p_umbral;
  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;

revoke execute on function public.revisar_reportes_abuso(integer, interval) from public, anon, authenticated;

drop trigger if exists abuse_threshold_trigger on public.abuse_reports;
create trigger abuse_threshold_trigger
  after insert on public.abuse_reports
  for each row execute function public.check_abuse_threshold();

-- RLS: cada usuario crea y ve solo sus propios reportes (no son públicos)
alter table public.abuse_reports enable row level security;

create policy "el usuario crea su reporte"
  on public.abuse_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "el usuario ve sus reportes"
  on public.abuse_reports
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "el usuario actualiza su reporte"
  on public.abuse_reports
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- Reactivar una marca caducada (Fase 10)
-- security definer: revive SOLO trapitos 'inactivo' (caducados) -> 'activo'.
-- Nunca revive los 'oculto' (ocultados por abuso). Registra una confirmación
-- fresca del reactivador para refrescar la actividad (y no recaducar al toque).
-- -------------------------------------------------------------
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
    return false; -- no estaba caducado (o estaba oculto): no se reactiva
  end if;

  -- Confirmación fresca del reactivador (refresca last_activity)
  insert into public.spot_reports (spot_id, user_id, tipo, franjas, created_at)
  values (p_spot_id, v_uid, 'confirma', p_franjas, now())
  on conflict (spot_id, user_id)
  do update set tipo = 'confirma', franjas = excluded.franjas, created_at = now();

  return true;
end;
$$;

grant execute on function public.reactivar_trapito(uuid, text[]) to authenticated;

-- =============================================================
-- Anti-abuso de la auth anónima (Fase 12)
-- Cualquiera puede crear usuarios anónimos ilimitados desde el navegador, así
-- que la identidad no vale como control: lo que se limita es el VOLUMEN por
-- usuario, con un cupo más chico mientras la cuenta es recién nacida.
-- La primera marca/voto sale al instante (no rompe "Participar y colaborar").
-- Los errores usan SQLSTATE 'PT429'/'PT409': PostgREST los traduce a HTTP
-- 429/409 y el front muestra el mensaje tal cual (src/lib/errors.js).
-- =============================================================

-- Índices de apoyo: los límites cuentan filas por usuario y fecha.
create index if not exists trapito_spots_autor_idx
  on public.trapito_spots (created_by, created_at desc);

create index if not exists spot_reports_user_idx
  on public.spot_reports (user_id, created_at desc);

create index if not exists abuse_reports_user_idx
  on public.abuse_reports (user_id, created_at desc);

-- ¿La cuenta que hace la acción es "nueva"? security definer porque auth.users
-- no es legible por el cliente. Null si no hay sesión (service_role).
create or replace function public.cuenta_mas_nueva_que(p_edad interval)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (now() - u.created_at) < p_edad
  from auth.users u
  where u.id = auth.uid();
$$;

revoke execute on function public.cuenta_mas_nueva_que(interval) from public, anon, authenticated;

-- Límite de altas de trapitos
create or replace function public.limitar_altas_spots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Tuneá los límites acá.
  c_max_hora         constant integer := 10;  -- marcas por hora
  c_max_dia          constant integer := 30;  -- marcas por día
  c_max_cuenta_nueva constant integer := 8;   -- marcas en la 1ª hora de vida de la cuenta
  c_radio_dup_m      constant double precision := 25;  -- distancia mínima entre marcas propias
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  -- Sin sesión (service_role, seeds, mantenimiento): no se limita.
  if v_uid is null then
    return new;
  end if;

  select count(*) into v_count
  from public.trapito_spots
  where created_by = v_uid and created_at > now() - interval '1 hour';

  if v_count >= c_max_hora then
    raise exception 'Llegaste al límite de % marcas por hora. Probá de nuevo más tarde.', c_max_hora
      using errcode = 'PT429';
  end if;

  select count(*) into v_count
  from public.trapito_spots
  where created_by = v_uid and created_at > now() - interval '1 day';

  if v_count >= c_max_dia then
    raise exception 'Llegaste al límite de % marcas por día. Seguís mañana.', c_max_dia
      using errcode = 'PT429';
  end if;

  -- Cupo chico mientras la cuenta es recién nacida: la primera marca sale al
  -- toque, pero una sesión anónima descartable no puede hacer daño.
  if coalesce(public.cuenta_mas_nueva_que(interval '1 hour'), false) then
    select count(*) into v_count
    from public.trapito_spots
    where created_by = v_uid;

    if v_count >= c_max_cuenta_nueva then
      raise exception 'Recién empezás: podés marcar hasta % trapitos en tu primera hora. Mientras tanto, confirmá los que ya están.', c_max_cuenta_nueva
        using errcode = 'PT429';
    end if;
  end if;

  -- Anti-duplicado: no dos marcas propias casi en el mismo lugar. Corta el
  -- "dump" de decenas de marcas sobre la misma cuadra.
  if exists (
    select 1 from public.trapito_spots
    where created_by = v_uid
      and st_dwithin(geom, new.geom, c_radio_dup_m)
  ) then
    raise exception 'Ya marcaste un trapito casi en el mismo lugar. Si es el mismo, confirmalo desde el mapa.'
      using errcode = 'PT409';
  end if;

  return new;
end;
$$;

drop trigger if exists limitar_altas_spots_trigger on public.trapito_spots;
create trigger limitar_altas_spots_trigger
  before insert on public.trapito_spots
  for each row execute function public.limitar_altas_spots();

-- Límite de votos. Aplica a insert y update: votar es un upsert.
create or replace function public.limitar_votos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_hora         constant integer := 40;  -- votos por hora
  c_max_cuenta_nueva constant integer := 15;  -- votos en la 1ª hora de vida de la cuenta
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    return new;
  end if;

  -- La fila que se está actualizando no cuenta contra sí misma.
  select count(*) into v_count
  from public.spot_reports
  where user_id = v_uid
    and created_at > now() - interval '1 hour'
    and id is distinct from new.id;

  if v_count >= c_max_hora then
    raise exception 'Votaste muchas veces seguidas. Esperá un rato y seguí.'
      using errcode = 'PT429';
  end if;

  if coalesce(public.cuenta_mas_nueva_que(interval '1 hour'), false) then
    select count(*) into v_count
    from public.spot_reports
    where user_id = v_uid
      and id is distinct from new.id;

    if v_count >= c_max_cuenta_nueva then
      raise exception 'Recién empezás: podés votar hasta % veces en tu primera hora.', c_max_cuenta_nueva
        using errcode = 'PT429';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists limitar_votos_trigger on public.spot_reports;
create trigger limitar_votos_trigger
  before insert or update on public.spot_reports
  for each row execute function public.limitar_votos();

-- Límite de reportes de abuso
create or replace function public.limitar_reportes_abuso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_hora constant integer := 10;  -- reportes por hora
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    return new;
  end if;

  select count(*) into v_count
  from public.abuse_reports
  where user_id = v_uid
    and created_at > now() - interval '1 hour'
    and id is distinct from new.id;

  if v_count >= c_max_hora then
    raise exception 'Enviaste muchos reportes seguidos. Esperá un rato y seguí.'
      using errcode = 'PT429';
  end if;

  return new;
end;
$$;

drop trigger if exists limitar_reportes_abuso_trigger on public.abuse_reports;
create trigger limitar_reportes_abuso_trigger
  before insert or update on public.abuse_reports
  for each row execute function public.limitar_reportes_abuso();
