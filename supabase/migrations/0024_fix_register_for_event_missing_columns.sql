-- =====================================================================
-- Monad Africa — 0024: Fix register_for_event() — ensure columns exist
-- BEFORE anything references them (0023 failed on this exact gap)
-- Run in Supabase SQL Editor AFTER 0001-0021 (0023 partially failed
-- and rolled back entirely — nothing from it is live; this file does
-- not depend on it having succeeded).
--
-- WHY THIS FILE EXISTS: 0023 failed with
--   ERROR: 42703: column "invite_code" does not exist
-- at its `create unique index ... (invite_code)` step, proving that
-- column isn't actually on public.event_registrations despite an
-- earlier unverified claim that it was. Because Supabase's SQL Editor
-- runs a pasted script as one transaction, that failure rolled back
-- everything in 0023, including its DROP of any stray
-- register_for_event overload — so nothing from 0023 is live.
--
-- This file fixes the actual gap: every column register_for_event
-- needs is guaranteed to exist via ADD COLUMN IF NOT EXISTS BEFORE any
-- statement (index or function) references it — no column's existence
-- is assumed. Everything else is unchanged from 0023's intent. No
-- other table is touched, no existing row's data is modified, RLS is
-- re-asserted (not changed), and the frontend is untouched.
-- =====================================================================

-- Step 1: guarantee every column the function needs actually exists.
-- No-op for any column already present; adds it, nullable, otherwise.
-- Does not touch event_id, user_id, status, registered_at, created_at,
-- or any existing row.
alter table public.event_registrations
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists country text,
  add column if not exists twitter text,
  add column if not exists phone text,
  add column if not exists wallet_address text,
  add column if not exists invite_code text;

alter table public.event_registrations enable row level security;

-- Step 2: drop every existing register_for_event overload, whatever
-- its current signature is, so exactly one — matching the frontend —
-- exists afterward.
do $$
declare
  r record;
begin
  for r in
    select p.oid, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'register_for_event'
  loop
    execute format('drop function public.register_for_event(%s)', r.args);
    raise notice 'Dropped register_for_event(%) before recreating the correct version.', r.args;
  end loop;
end $$;

-- Step 3: dependency register_for_event() calls — self-contained here.
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

-- Step 4: NOW safe — the column is guaranteed to exist from Step 1.
create unique index if not exists idx_event_registrations_invite_code on public.event_registrations (invite_code);

-- Step 5: the function itself — parameters match the frontend exactly.
create function public.register_for_event(
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
  v_user_id uuid;
  v_event public.events;
  v_email text;
  v_code text;
  v_reg_id uuid;
  v_count int;
  v_attempts int := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'VALIDATION: Please sign in to register for this event.';
  end if;
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'VALIDATION: Your account profile could not be found.';
  end if;

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

  if exists (select 1 from public.event_registrations where event_id = p_event_id and user_id = v_user_id) then
    raise exception 'DUPLICATE_EMAIL: You are already registered for this event';
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

  insert into public.event_registrations (event_id, user_id, full_name, email, country, twitter, phone, wallet_address, invite_code)
  values (p_event_id, v_user_id, trim(p_full_name), v_email, trim(p_country), nullif(trim(p_twitter), ''), nullif(trim(p_phone), ''), nullif(trim(p_wallet_address), ''), v_code)
  returning id into v_reg_id;

  return query select v_reg_id, v_code, v_event.title, v_event.event_date, v_event.start_time, v_event.location;
end;
$$;

revoke all on function public.register_for_event(uuid, text, text, text, text, text, text) from public;
revoke all on function public.register_for_event(uuid, text, text, text, text, text, text) from anon;
grant execute on function public.register_for_event(uuid, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. event_registrations gained only the 7 nullable text columns
-- above (if it didn't already have them) — nothing else changed on
-- it. Exactly one register_for_event() now exists, matching the
-- frontend. No other table or the frontend was touched.
-- =====================================================================
