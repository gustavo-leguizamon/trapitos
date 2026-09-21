-- =============================================================
-- Migración Fase 13 — backoffice de administración
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 12).
-- Es idempotente.
--
-- El frontend es un SPA público: el bundle y la anon key se leen desde
-- cualquier navegador, así que esconder una pantalla no protege nada. Lo único
-- que separa a un admin del resto es lo que la base le deja hacer, y eso se
-- define acá.
--
-- Criterio: no se ensanchan las políticas RLS de las tablas. En lugar de darle
-- "escritura total" al admin, se le da un conjunto cerrado de funciones
-- (security definer + guarda es_admin()). El poder del panel es exactamente
-- esta lista y nada más; para poder algo nuevo hay que agregarlo acá a
-- propósito. Los códigos 'PT403'/'PT422' los traduce PostgREST a HTTP 403/422.
-- =============================================================

-- -------------------------------------------------------------
-- Quién es admin
-- Tabla con RLS activo y CERO políticas: ningún cliente (ni anon ni
-- authenticated) puede leerla ni escribirla. Se administra desde el Dashboard
-- (SQL Editor / Table Editor), que usa service_role y no pasa por RLS.
-- -------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nota       text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- ¿El usuario logueado es admin?
-- security definer: necesita leer public.admins (invisible por RLS) y auth.users.
-- Se exige cuenta NO anónima: una sesión anónima es gratis de crear y
-- descartable, así que nunca puede ser la identidad de un administrador.
create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admins a
    join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid()
      and coalesce(u.is_anonymous, false) = false
  );
$$;

-- La usan las funciones del panel, y también el front para saber si muestra el
-- panel o el login (solo revela tu propio estado).
revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- Guarda común de las funciones del panel.
create or replace function public.exigir_admin()
returns void
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.es_admin() then
    raise exception 'Necesitás permisos de administrador.' using errcode = 'PT403';
  end if;
end;
$$;

revoke execute on function public.exigir_admin() from public, anon, authenticated;

-- -------------------------------------------------------------
-- Resumen para el encabezado del panel
-- -------------------------------------------------------------
create or replace function public.admin_resumen()
returns table (
  activos    bigint,
  inactivos  bigint,
  ocultos    bigint,
  reportados bigint,
  anonimos   bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.exigir_admin();
  return query
  select
    count(*) filter (where s.status = 'activo')   as activos,
    count(*) filter (where s.status = 'inactivo') as inactivos,
    count(*) filter (where s.status = 'oculto')   as ocultos,
    count(*) filter (where exists (
      select 1 from public.abuse_reports a where a.spot_id = s.id
    ))                                            as reportados,
    (select count(*) from auth.users u
      where coalesce(u.is_anonymous, false))      as anonimos
  from public.trapito_spots s;
end;
$$;

revoke execute on function public.admin_resumen() from public, anon;
grant execute on function public.admin_resumen() to authenticated;

-- -------------------------------------------------------------
-- Listado del panel
-- A diferencia de spots_cercanos, ve TODOS los estados (incluido 'oculto', que
-- es justo lo que hay que moderar) y agrega los reportes de abuso y algo del
-- autor. No devuelve quién reportó: para decidir no hace falta.
-- -------------------------------------------------------------
create or replace function public.admin_spots(
  p_status          text    default null,   -- null = todos
  p_buscar          text    default null,   -- calle o descripción (ilike)
  p_solo_reportados boolean default false,
  p_limit           integer default 100,
  p_offset          integer default 0
)
returns table (
  id              uuid,
  lat             double precision,
  lng             double precision,
  calle           text,
  descripcion     text,
  status          text,
  created_at      timestamptz,
  last_activity   timestamptz,
  confirma_count  bigint,
  desmiente_count bigint,
  abuse_count     bigint,
  abuse_motivos   jsonb,
  autor_id        uuid,
  autor_anonimo   boolean,
  autor_creado_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public.exigir_admin();
  return query
  select
    s.id, s.lat, s.lng, s.calle, s.descripcion, s.status, s.created_at,
    -- greatest ignora los nulls: si no hay votos, queda la fecha de alta.
    greatest(
      s.created_at,
      (select max(r.created_at) from public.spot_reports r where r.spot_id = s.id)
    ) as last_activity,
    (select count(*) from public.spot_reports r
      where r.spot_id = s.id and r.tipo = 'confirma')  as confirma_count,
    (select count(*) from public.spot_reports r
      where r.spot_id = s.id and r.tipo = 'desmiente') as desmiente_count,
    (select count(*) from public.abuse_reports a where a.spot_id = s.id) as abuse_count,
    -- [{ motivo, cantidad }, ...], o null si nadie reportó
    (select jsonb_agg(m.fila order by m.fila->>'motivo')
       from (
         select jsonb_build_object('motivo', a.motivo, 'cantidad', count(*)) as fila
         from public.abuse_reports a
         where a.spot_id = s.id
         group by a.motivo
       ) m) as abuse_motivos,
    s.created_by                    as autor_id,
    coalesce(u.is_anonymous, false) as autor_anonimo,
    u.created_at                    as autor_creado_at
  from public.trapito_spots s
  left join auth.users u on u.id = s.created_by
  where (nullif(p_status, '') is null or s.status = p_status)
    and (
      p_buscar is null or p_buscar = ''
      or s.calle ilike '%' || p_buscar || '%'
      or s.descripcion ilike '%' || p_buscar || '%'
    )
    and (
      not coalesce(p_solo_reportados, false)
      or exists (select 1 from public.abuse_reports a where a.spot_id = s.id)
    )
  order by s.created_at desc
  limit  least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_spots(text, text, boolean, integer, integer)
  from public, anon;
grant execute on function public.admin_spots(text, text, boolean, integer, integer)
  to authenticated;

-- -------------------------------------------------------------
-- Acciones sobre una marca
-- La columna status no tiene CHECK en la tabla, así que la validación de los
-- estados válidos vive acá: el panel no puede dejar una marca en un estado que
-- el resto de la app no entienda.
-- -------------------------------------------------------------
create or replace function public.admin_set_status(
  p_spot_id uuid,
  p_status  text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  perform public.exigir_admin();

  if p_status not in ('activo', 'inactivo', 'oculto') then
    raise exception 'Estado inválido: %', p_status using errcode = 'PT422';
  end if;

  update public.trapito_spots
  set status = p_status
  where id = p_spot_id and status is distinct from p_status;
  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

revoke execute on function public.admin_set_status(uuid, text) from public, anon;
grant execute on function public.admin_set_status(uuid, text) to authenticated;

-- Corregir el texto de una marca (calle / descripción). '' se guarda como null.
create or replace function public.admin_editar_spot(
  p_spot_id     uuid,
  p_calle       text,
  p_descripcion text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  perform public.exigir_admin();

  update public.trapito_spots
  set calle       = nullif(btrim(coalesce(p_calle, '')), ''),
      descripcion = nullif(btrim(coalesce(p_descripcion, '')), '')
  where id = p_spot_id;
  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

revoke execute on function public.admin_editar_spot(uuid, text, text) from public, anon;
grant execute on function public.admin_editar_spot(uuid, text, text) to authenticated;

-- Borrar una marca. Por cascada se van sus votos y sus reportes de abuso.
-- Para casi todo alcanza con ocultar (es reversible); esto es para lo que no
-- debe quedar ni registrado.
create or replace function public.admin_borrar_spot(p_spot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  perform public.exigir_admin();

  delete from public.trapito_spots where id = p_spot_id;
  get diagnostics v_deleted = row_count;

  return v_deleted > 0;
end;
$$;

revoke execute on function public.admin_borrar_spot(uuid) from public, anon;
grant execute on function public.admin_borrar_spot(uuid) to authenticated;

-- -------------------------------------------------------------
-- Mantenimiento a pedido
-- expirar_trapitos y revisar_reportes_abuso tienen el execute revocado a
-- authenticated (son tareas de pg_cron). Estos wrappers las dejan disparar a
-- mano desde el panel sin abrirlas a cualquier usuario logueado.
-- -------------------------------------------------------------
create or replace function public.admin_expirar_trapitos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_admin();
  return public.expirar_trapitos();
end;
$$;

revoke execute on function public.admin_expirar_trapitos() from public, anon;
grant execute on function public.admin_expirar_trapitos() to authenticated;

create or replace function public.admin_revisar_reportes_abuso()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.exigir_admin();
  return public.revisar_reportes_abuso();
end;
$$;

revoke execute on function public.admin_revisar_reportes_abuso() from public, anon;
grant execute on function public.admin_revisar_reportes_abuso() to authenticated;

-- Cuántas cuentas anónimas se podrían borrar (mismo criterio que la limpieza).
-- Sirve para mirar antes de apretar el botón.
create or replace function public.admin_anonimos_borrables(p_dias integer default 30)
returns bigint
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_count bigint;
begin
  perform public.exigir_admin();

  select count(*) into v_count
  from auth.users u
  where coalesce(u.is_anonymous, false)
    and u.created_at < now() - make_interval(days => greatest(coalesce(p_dias, 30), 1))
    and not exists (select 1 from public.trapito_spots s where s.created_by = u.id)
    and not exists (select 1 from public.spot_reports  r where r.user_id    = u.id)
    and not exists (select 1 from public.abuse_reports a where a.user_id    = u.id);

  return v_count;
end;
$$;

revoke execute on function public.admin_anonimos_borrables(integer) from public, anon;
grant execute on function public.admin_anonimos_borrables(integer) to authenticated;

-- Borrar las cuentas anónimas viejas que no dejaron nada. Las que dejaron algo
-- se quedan: borrarlas se llevaría sus votos y reportes por cascada.
-- Devuelve cuántas borró.
create or replace function public.admin_limpiar_anonimos(p_dias integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  perform public.exigir_admin();

  delete from auth.users u
  where coalesce(u.is_anonymous, false)
    and u.created_at < now() - make_interval(days => greatest(coalesce(p_dias, 30), 1))
    and not exists (select 1 from public.trapito_spots s where s.created_by = u.id)
    and not exists (select 1 from public.spot_reports  r where r.user_id    = u.id)
    and not exists (select 1 from public.abuse_reports a where a.user_id    = u.id);
  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke execute on function public.admin_limpiar_anonimos(integer) from public, anon;
grant execute on function public.admin_limpiar_anonimos(integer) to authenticated;

-- =============================================================
-- Para darte permiso de admin (una sola vez):
--   1) Authentication > Users > Add user: email + contraseña, con
--      "Auto Confirm User" activado.
--   2) Acá, con ese email:
--        insert into public.admins (user_id, nota)
--        select id, 'dueño' from auth.users where email = 'vos@ejemplo.com'
--        on conflict (user_id) do nothing;
--   3) Authentication > Sign In / Providers > Email: apagá "Enable signups".
--      Si no, cualquiera puede crearse una cuenta con contraseña; no sería
--      admin, pero no hace falta que exista.
--   4) Recomendado: activá MFA en tu cuenta.
-- =============================================================
