-- =============================================================
-- Fase 3 (opcional) — programar la caducidad automática con pg_cron
-- Ejecutar DESPUÉS de phase3_caducidad.sql.
--
-- Requiere la extensión pg_cron. En Supabase podés habilitarla desde
-- Dashboard > Database > Extensions (buscar "pg_cron"), o con la línea de abajo.
-- =============================================================

create extension if not exists pg_cron;

-- Corre todos los días a las 04:00 (UTC) y desactiva las marcas caducadas.
-- cron.schedule reemplaza el job si ya existe uno con el mismo nombre.
select cron.schedule(
  'expirar-trapitos-diario',
  '0 4 * * *',
  $$ select public.expirar_trapitos(); $$
);

-- Para ver los jobs programados:
--   select * from cron.job;
-- Para desprogramarlo:
--   select cron.unschedule('expirar-trapitos-diario');
