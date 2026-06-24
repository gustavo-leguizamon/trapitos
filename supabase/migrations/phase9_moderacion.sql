-- =============================================================
-- Migración Fase 9 — moderación / reportes de abuso
-- Ejecutar en: Supabase Dashboard > SQL Editor (sobre una base con Fase 8).
-- Es idempotente.
-- =============================================================

-- 1) Reportes de abuso: un reporte por usuario y trapito
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

-- 2) Al llegar a 3 usuarios distintos, ocultar el trapito (status = 'oculto')
create or replace function public.check_abuse_threshold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(distinct user_id) into v_count
  from public.abuse_reports
  where spot_id = new.spot_id;

  if v_count >= 3 then
    update public.trapito_spots
    set status = 'oculto'
    where id = new.spot_id and status = 'activo';
  end if;
  return new;
end;
$$;

drop trigger if exists abuse_threshold_trigger on public.abuse_reports;
create trigger abuse_threshold_trigger
  after insert on public.abuse_reports
  for each row execute function public.check_abuse_threshold();

-- 3) RLS: cada usuario crea y ve solo sus propios reportes
alter table public.abuse_reports enable row level security;

drop policy if exists "el usuario crea su reporte" on public.abuse_reports;
create policy "el usuario crea su reporte"
  on public.abuse_reports for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "el usuario ve sus reportes" on public.abuse_reports;
create policy "el usuario ve sus reportes"
  on public.abuse_reports for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "el usuario actualiza su reporte" on public.abuse_reports;
create policy "el usuario actualiza su reporte"
  on public.abuse_reports for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
