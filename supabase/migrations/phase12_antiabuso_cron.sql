-- =============================================================
-- Fase 12 (opcional) — repaso diario de los reportes de abuso
-- Ejecutar DESPUÉS de phase12_antiabuso.sql.
--
-- Por qué hace falta: el trigger de abuso solo corre cuando llega un reporte
-- nuevo. Si tres cuentas reportaron una marca cuando todavía eran nuevas (y por
-- eso no contaban), nadie vuelve a evaluarla. Este job la repasa a diario, ya
-- con las cuentas maduradas.
--
-- Requiere pg_cron (Dashboard > Database > Extensions), igual que la caducidad.
-- =============================================================

create extension if not exists pg_cron;

-- Todos los días a las 04:10 (UTC), unos minutos después de la caducidad.
-- cron.schedule reemplaza el job si ya existe uno con el mismo nombre.
select cron.schedule(
  'revisar-reportes-abuso-diario',
  '10 4 * * *',
  $$ select public.revisar_reportes_abuso(); $$
);

-- Para ver los jobs programados:
--   select * from cron.job;
-- Para desprogramarlo:
--   select cron.unschedule('revisar-reportes-abuso-diario');
