-- =============================================================
-- Migración Fase 4 — reputación de usuarios
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 3).
-- Es idempotente.
-- =============================================================

-- Agregados del usuario logueado para calcular su reputación en el front.
-- security definer: necesita contar también las marcas inactivas/propias,
-- pero SIEMPRE acotado a auth.uid(), así que no expone datos de terceros.
-- No cuenta los autovotos (confirmar/desmentir las propias marcas).
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
    (select count(*) from public.trapito_spots s
       where s.created_by = auth.uid()),
    (select count(*) from public.spot_reports r
       join public.trapito_spots s on s.id = r.spot_id
       where s.created_by = auth.uid()
         and r.tipo = 'confirma'
         and r.user_id <> s.created_by),
    (select count(*) from public.spot_reports r
       join public.trapito_spots s on s.id = r.spot_id
       where s.created_by = auth.uid()
         and r.tipo = 'desmiente'
         and r.user_id <> s.created_by),
    (select count(*) from public.spot_reports r
       where r.user_id = auth.uid());
$$;

grant execute on function public.mi_reputacion() to authenticated;

-- Probarla (con un usuario logueado, devuelve sus agregados):
--   select * from public.mi_reputacion();
