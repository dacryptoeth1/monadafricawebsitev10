-- =====================================================================
-- Monad Africa — 0021: Verify + ensure events registration columns
-- + reload schema cache
-- Run in Supabase SQL Editor AFTER 0001-0020.
--
-- WHY THIS FILE EXISTS: the public Events page fails with
-- "Couldn't load events right now" because its query filters on
-- events.status (`.neq('status', 'draft')`), a column
-- 0016_events_table_unification.sql was supposed to add. Unlike a
-- plain `select('*')` (which never errors on a missing column, which
-- is why Home.tsx's small events widget and the Admin → Events list
-- still work), a WHERE-clause filter needs the column to genuinely
-- exist — if 0016 was never actually run against this database
-- (the same class of drift already seen with event_listings,
-- credit_ledger, and profiles.full_name), Postgres rejects the query
-- outright with "column events.status does not exist".
--
-- This file re-asserts every ADD COLUMN IF NOT EXISTS / policy /
-- trigger from 0016 that events registration depends on, reports
-- before/after via RAISE NOTICE, and reloads the PostgREST schema
-- cache — fully idempotent, safe to run whether or not 0016 already
-- succeeded. Nothing is dropped; no existing event or registration
-- row is touched. profiles is not referenced anywhere in this file.
-- =====================================================================

do $$
declare
  v_missing text[];
begin
  select array_agg(col) into v_missing
  from unnest(array['start_time','end_time','location','image_url','event_url','capacity','registration_deadline','registration_open','status','created_by','updated_at']) as col
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = col
  );

  if v_missing is null then
    raise notice 'BEFORE: all events registration columns already exist.';
  else
    raise notice 'BEFORE: missing events columns: %', v_missing;
  end if;
end $$;

alter table public.events
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists location text,
  add column if not exists image_url text,
  add column if not exists event_url text,
  add column if not exists capacity integer,
  add column if not exists registration_deadline timestamptz,
  add column if not exists registration_open boolean not null default true,
  add column if not exists status text not null default 'published',
  add column if not exists created_by uuid references public.admins (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.events drop constraint if exists events_capacity_check;
alter table public.events add constraint events_capacity_check check (capacity is null or capacity > 0);

alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check check (status in ('draft', 'published', 'cancelled'));

create index if not exists idx_events_status_date on public.events (status, event_date);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- Re-assert the public read policy (status <> 'draft' or admin) —
-- backfilled rows all default to 'published' via the ADD COLUMN
-- DEFAULT above, so nothing that was visible before this migration
-- becomes hidden by it.
drop policy if exists "events are public" on public.events;
create policy "events are public" on public.events for select
  using (status <> 'draft' or public.is_admin());

notify pgrst, 'reload schema';

do $$
declare
  v_missing text[];
begin
  select array_agg(col) into v_missing
  from unnest(array['start_time','end_time','location','image_url','event_url','capacity','registration_deadline','registration_open','status','created_by','updated_at']) as col
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = col
  );

  if v_missing is null then
    raise notice 'AFTER: all events registration columns exist. Schema cache reload sent.';
  else
    raise exception 'AFTER: still missing events columns: % — the ADD COLUMN above did not take effect.', v_missing;
  end if;
end $$;

-- =====================================================================
-- Done. No table dropped, no existing column altered/removed, no
-- event or registration data touched. profiles is not referenced.
-- =====================================================================
