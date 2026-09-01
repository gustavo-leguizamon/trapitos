-- =============================================================
-- Migración Fase 12 — anti-abuso de la auth anónima
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 11).
-- Es idempotente.
--
-- Problema que resuelve
-- ---------------------
-- Cualquiera puede crear usuarios anónimos ilimitados desde el navegador
-- (`signInAnonymously`). Con eso podía: inundar el mapa de marcas basura,
-- hundir una marca a fuerza de "ya no está", y —lo más grave— ocultar
-- cualquier trapito con solo 3 sesiones recién creadas (umbral de abuso).
--
-- Criterio
-- --------
-- 1) Límites de VOLUMEN por usuario (ráfaga por hora y total por día), con un
--    cupo más chico durante la primera hora de vida de la cuenta. La primera
--    marca/voto sale al instante: no rompe la UX de "Participar y colaborar".
-- 2) Las acciones DESTRUCTIVAS y automáticas (ocultar por abuso, caducar por
--    dudoso) solo cuentan cuentas con cierta antigüedad. Un ataque Sybil pasa
--    a costar 24 h de espera por cuenta, no un F5.
-- 3) Los votos que solo afectan lo que se MUESTRA (score de confianza) siguen
--    contando desde el minuto cero: son reversibles y de bajo impacto.
--
-- Los errores usan SQLSTATE 'PT429' / 'PT409': PostgREST los traduce a HTTP
-- 429 / 409 y el front muestra el mensaje tal cual (ver src/lib/errors.js).
-- =============================================================

-- -------------------------------------------------------------
-- 0) Índices de apoyo: los límites cuentan filas por usuario y fecha.
-- -------------------------------------------------------------
create index if not exists trapito_spots_autor_idx
  on public.trapito_spots (created_by, created_at desc);

create index if not exists spot_reports_user_idx
  on public.spot_reports (user_id, created_at desc);

create index if not exists abuse_reports_user_idx
  on public.abuse_reports (user_id, created_at desc);

-- -------------------------------------------------------------
-- 1) Helper: ¿la cuenta que hace la acción es "nueva"?
-- security definer porque auth.users no es legible por el cliente.
-- Devuelve null si no hay sesión (service_role / tareas de mantenimiento).
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- 2) Límite de altas de trapitos
-- -------------------------------------------------------------
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

  -- (a) Ráfaga: marcas en la última hora
  select count(*) into v_count
  from public.trapito_spots
  where created_by = v_uid and created_at > now() - interval '1 hour';

  if v_count >= c_max_hora then
    raise exception 'Llegaste al límite de % marcas por hora. Probá de nuevo más tarde.', c_max_hora
      using errcode = 'PT429';
  end if;

  -- (b) Volumen diario
  select count(*) into v_count
  from public.trapito_spots
  where created_by = v_uid and created_at > now() - interval '1 day';

  if v_count >= c_max_dia then
    raise exception 'Llegaste al límite de % marcas por día. Seguís mañana.', c_max_dia
      using errcode = 'PT429';
  end if;

  -- (c) Cupo chico mientras la cuenta es recién nacida: la primera marca sale
  --     al toque, pero una sesión anónima descartable no puede hacer daño.
  if coalesce(public.cuenta_mas_nueva_que(interval '1 hour'), false) then
    select count(*) into v_count
    from public.trapito_spots
    where created_by = v_uid;

    if v_count >= c_max_cuenta_nueva then
      raise exception 'Recién empezás: podés marcar hasta % trapitos en tu primera hora. Mientras tanto, confirmá los que ya están.', c_max_cuenta_nueva
        using errcode = 'PT429';
    end if;
  end if;

  -- (d) Anti-duplicado: no dos marcas propias casi en el mismo lugar.
  --     Corta el "dump" de decenas de marcas sobre la misma cuadra.
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

-- -------------------------------------------------------------
-- 3) Límite de votos (spot_reports)
-- Se aplica a insert y update: votar es un upsert que refresca created_at.
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- 4) Límite de reportes de abuso
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- 5) Ocultar por abuso: solo cuentan las cuentas con antigüedad
-- Antes: 3 sesiones anónimas recién creadas ocultaban cualquier marca.
-- Ahora: 3 usuarios distintos con al menos 24 h de antigüedad.
-- El reporte de una cuenta nueva igual se guarda (queda para moderación);
-- simplemente no dispara el ocultado automático.
-- -------------------------------------------------------------
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
-- eran nuevas, nadie vuelve a evaluar esa marca. Esta función repasa todo y se
-- programa junto a expirar_trapitos (ver phase12_antiabuso_cron.sql).
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

-- Tarea de mantenimiento: que no la invoquen los clientes (también desde PUBLIC).
revoke execute on function public.revisar_reportes_abuso(integer, interval) from public, anon, authenticated;

-- -------------------------------------------------------------
-- 6) Caducidad: los desmentidos también piden antigüedad
-- El criterio "muy dudoso" desactiva la marca, así que es destructivo: solo
-- cuentan los votos de cuentas con antigüedad. El criterio por inactividad no
-- cambia. Cambia la firma (nuevo parámetro), por eso se dropea primero.
-- -------------------------------------------------------------
drop function if exists public.expirar_trapitos(integer, integer);
drop function if exists public.expirar_trapitos(integer, integer, interval);

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
      -- (a) muchos más desmentidos que confirmaciones, contando solo votos de
      --     cuentas con antigüedad (si no, 3 sesiones anónimas matan la marca)
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

revoke execute on function public.expirar_trapitos(integer, integer, interval) from public, anon, authenticated;
