-- =====================================================================
-- Monad Africa — 0016: Unify events + event_registrations onto the
-- REAL existing schema (no event_listings)
-- Run in Supabase SQL Editor AFTER 0001-0015 (0015 is safe to have
-- skipped or partially run — nothing here depends on it succeeding).
--
-- WHY THIS FILE EXISTS: 0015_event_registration_system.sql designed the
-- registration feature around a brand-new `event_listings` table. On
-- this project's live database that table was never actually created,
-- which is why the app fails with:
--   "Could not find the table 'public.event_listings' in the schema
--   cache"
-- The database's real, existing tables for this feature are `events`
-- (already used by the homepage/admin "Events" announcement feed since
-- 0002_user_platform.sql) and `event_registrations`. This migration:
--   1. Extends the EXISTING `events` table with the columns the
--      registration feature needs (all additive, nullable or defaulted
--      — no existing row or column is touched/removed).
--   2. Makes sure `event_registrations` has every column it needs and a
--      foreign key to `events` (not event_listings), without dropping
--      or recreating the table if it already exists.
--   3. Re-points the four registration RPCs at `events` instead of
--      event_listings.
-- `event_listings` is never created by this file. If it happens to
-- exist on some environment from a prior manual run of 0015, it is left
-- alone (untouched, unused) rather than dropped — this file only adds,
-- never destroys.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EVENTS: add registration-capable columns. `events` already has
--    id, title, description, event_date, event_type, link, created_at
--    (0002_user_platform.sql) — none of that changes. `event_type` and
--    `link` stay as-is and keep serving the simple announcement feed
--    (Admin → Events tab); the columns below are additive and only
--    populated when an event also needs registration/check-in.
-- ---------------------------------------------------------------------
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

-- Public read policy already exists from 0002 ("events are public",
-- using (true)) — replace it so drafts are hidden from non-admins, same
-- rule the abandoned event_listings design had. Existing rows all got
-- backfilled to status='published' by the ADD COLUMN DEFAULT above, so
-- nothing that was visible before this migration becomes hidden by it.
drop policy if exists "events are public" on public.events;
create policy "events are public" on public.events for select
  using (status <> 'draft' or public.is_admin());

-- ---------------------------------------------------------------------
-- 2. EVENT_REGISTRATIONS: ensure every column the app needs exists.
--    CREATE TABLE IF NOT EXISTS covers a fresh environment where this
--    table genuinely doesn't exist yet (references events, not
--    event_listings); ADD COLUMN IF NOT EXISTS covers this project's
--    live database where the table already exists from some earlier,
--    unknown-to-us setup step.
-- ---------------------------------------------------------------------
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  full_name text not null,
  email text not null,
  country text not null,
  twitter text,
  phone text,
  wallet_address text,
  invite_code text not null,
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid references public.admins (id) on delete set null,
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  email_last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_registrations
  add column if not exists event_id uuid,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists country text,
  add column if not exists twitter text,
  add column if not exists phone text,
  add column if not exists wallet_address text,
  add column if not exists invite_code text,
  add column if not exists checked_in boolean not null default false,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid,
  add column if not exists email_sent boolean not null default false,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Add the FK to events (not event_listings) only if some equivalent
-- constraint isn't already there — wrapped so it can never abort the
-- rest of this migration (e.g. if pre-existing rows can't satisfy it).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'event_registrations'
      and constraint_type = 'FOREIGN KEY' and constraint_name = 'event_registrations_event_id_fkey'
  ) then
    begin
      alter table public.event_registrations
        add constraint event_registrations_event_id_fkey
        foreign key (event_id) references public.events (id) on delete cascade;
    exception when others then
      raise notice 'Skipped adding event_registrations_event_id_fkey: %', sqlerrm;
    end;
  end if;
end $$;

create unique index if not exists idx_event_registrations_invite_code on public.event_registrations (invite_code);

-- Guarded rather than a bare CREATE INDEX: event_id is added above via
-- ADD COLUMN IF NOT EXISTS, so it should always be present by this
-- point, but these two indexes are the only things that actually
-- require it — checking first means a column-add that silently didn't
-- take (a permissions issue, etc.) reports clearly via RAISE NOTICE
-- instead of aborting the rest of this migration.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'event_registrations' and column_name = 'event_id'
  ) then
    create unique index if not exists idx_event_registrations_event_email on public.event_registrations (event_id, lower(email));
    create index if not exists idx_event_registrations_event on public.event_registrations (event_id);
  else
    raise notice 'Skipped idx_event_registrations_event_email / idx_event_registrations_event: event_registrations.event_id does not exist.';
  end if;
end $$;

drop trigger if exists trg_event_registrations_updated_at on public.event_registrations;
create trigger trg_event_registrations_updated_at before update on public.event_registrations
  for each row execute function public.set_updated_at();

alter table public.event_registrations enable row level security;

-- No insert policy for anon/authenticated on purpose — every insert
-- goes through register_for_event() below, which is SECURITY DEFINER
-- and bypasses RLS itself after its own validation.
drop policy if exists "admins view registrations" on public.event_registrations;
create policy "admins view registrations" on public.event_registrations for select using (public.is_admin());
drop policy if exists "admins update registrations" on public.event_registrations;
create policy "admins update registrations" on public.event_registrations for update using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. INVITE CODE GENERATOR — unchanged from 0015, re-declared here so
--    this file is fully self-contained even if 0015 never ran.
-- ---------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  alen constant int := length(alphabet);
  raw bytea;
  code text := '';
  i int;
  byte_val int;
begin
  raw := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 0..7 loop
    byte_val := get_byte(raw, i);
    code := code || substr(alphabet, (byte_val % alen) + 1, 1);
    if i = 3 then code := code || '-'; end if;
  end loop;
  return 'MONAF-' || code;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. RPCs re-pointed at `events` instead of `event_listings`. Behavior
--    is otherwise identical to 0015's versions.
-- ---------------------------------------------------------------------
create or replace function public.event_registration_count(p_event_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.event_registrations where event_id = p_event_id;
$$;
revoke all on function public.event_registration_count(uuid) from public;
grant execute on function public.event_registration_count(uuid) to anon, authenticated;

create or replace function public.register_for_event(
  p_event_id uuid,
  p_full_name text,
  p_email text,
  p_country text,
  p_twitter text default null,
  p_phone text default null,
  p_wallet_address text default null
)
returns table (
  registration_id uuid,
  invite_code text,
  event_title text,
  event_date date,
  event_start_time time,
  event_location text
)
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
  v_email text;
  v_code text;
  v_reg_id uuid;
  v_count int;
  v_attempts int := 0;
begin
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'VALIDATION: Full name is required';
  end if;
  if coalesce(trim(p_country), '') = '' then
    raise exception 'VALIDATION: Country is required';
  end if;

  v_email := lower(trim(p_email));
  if v_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'VALIDATION: A valid email address is required';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'NOT_FOUND: Event not found';
  end if;
  if v_event.status <> 'published' then
    raise exception 'CLOSED: This event is not open for registration';
  end if;
  if not v_event.registration_open then
    raise exception 'CLOSED: Registration is closed for this event';
  end if;
  if v_event.registration_deadline is not null and now() > v_event.registration_deadline then
    raise exception 'DEADLINE_PASSED: The registration deadline for this event has passed';
  end if;

  if exists (select 1 from public.event_registrations where event_id = p_event_id and lower(email) = v_email) then
    raise exception 'DUPLICATE_EMAIL: This email is already registered for this event';
  end if;

  if v_event.capacity is not null then
    select count(*) into v_count from public.event_registrations where event_id = p_event_id;
    if v_count >= v_event.capacity then
      raise exception 'CAPACITY_FULL: This event has reached capacity';
    end if;
  end if;

  loop
    v_code := public.generate_invite_code();
    v_attempts := v_attempts + 1;
    exit when not exists (select 1 from public.event_registrations where invite_code = v_code);
    if v_attempts > 20 then
      raise exception 'Could not generate a unique invite code — please try again';
    end if;
  end loop;

  insert into public.event_registrations (event_id, full_name, email, country, twitter, phone, wallet_address, invite_code)
  values (p_event_id, trim(p_full_name), v_email, trim(p_country), nullif(trim(p_twitter), ''), nullif(trim(p_phone), ''), nullif(trim(p_wallet_address), ''), v_code)
  returning id into v_reg_id;

  return query select v_reg_id, v_code, v_event.title, v_event.event_date, v_event.start_time, v_event.location;
end;
$$;
revoke all on function public.register_for_event(uuid, text, text, text, text, text, text) from public;
grant execute on function public.register_for_event(uuid, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_lookup_invite_code(p_code text)
returns table (
  registration_id uuid, full_name text, email text, event_id uuid,
  event_title text, event_date date, event_location text,
  checked_in boolean, checked_in_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  return query
    select r.id, r.full_name, r.email, e.id, e.title, e.event_date, e.location, r.checked_in, r.checked_in_at
    from public.event_registrations r join public.events e on e.id = r.event_id
    where r.invite_code = upper(trim(p_code));
end;
$$;
revoke all on function public.admin_lookup_invite_code(text) from public;
grant execute on function public.admin_lookup_invite_code(text) to authenticated;

create or replace function public.admin_check_in_registration(p_code text)
returns table (
  registration_id uuid, full_name text, email text, event_title text, event_date date,
  already_checked_in boolean, checked_in_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_reg public.event_registrations;
  v_event public.events;
  v_was_checked_in boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_reg from public.event_registrations where invite_code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'INVALID_CODE: No registration found for this invite code';
  end if;

  select * into v_event from public.events where id = v_reg.event_id;
  v_was_checked_in := v_reg.checked_in;

  if not v_was_checked_in then
    update public.event_registrations set checked_in = true, checked_in_at = now(), checked_in_by = auth.uid()
      where id = v_reg.id returning * into v_reg;
  end if;

  return query select v_reg.id, v_reg.full_name, v_reg.email, v_event.title, v_event.event_date, v_was_checked_in, v_reg.checked_in_at;
end;
$$;
revoke all on function public.admin_check_in_registration(text) from public;
grant execute on function public.admin_check_in_registration(text) to authenticated;

-- =====================================================================
-- Done. `event_listings` is not created or referenced anywhere in this
-- file. Application code must query `events` and `event_registrations`
-- only — see src/pages/Events.tsx, src/pages/admin/AdminEventRegistrations.tsx,
-- netlify/functions/send-invite-email.ts.
-- =====================================================================
