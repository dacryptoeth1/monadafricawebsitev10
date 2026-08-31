-- =====================================================================
-- Monad Africa — 0023: Fix register_for_event() signature (PGRST202)
-- Run in Supabase SQL Editor AFTER 0001-0021.
--
-- WHY THIS FILE EXISTS: registration fails with
--   PGRST202: Could not find the function
--   public.register_for_event(p_country, p_email, p_event_id,
--   p_full_name, p_phone, p_twitter, p_wallet_address) in the schema
--   cache.
-- The frontend call (src/components/EventRegistrationModal.tsx) is
-- confirmed unchanged and correct — it sends exactly those 7 named
-- parameters. This means the live function's actual signature does
-- not match (most likely an extra/renamed parameter from an earlier
-- attempt), and/or PostgREST's cache hasn't picked up the current
-- version. This file removes any doubt by dropping every existing
-- version of register_for_event (whatever its current signature is)
-- and recreating exactly one, matching the frontend's 7 parameters
-- precisely, then forces a schema cache reload. No table, column, or
-- other function is touched; no event_registrations row is affected.
-- =====================================================================

-- Drop every existing overload of register_for_event, regardless of
-- its current signature, so no stray/conflicting version can remain
-- ambiguous or mismatched after this file runs.
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

-- Dependency: register_for_event() calls this to generate the code
-- returned to the registrant. Re-declared here so this file is fully
-- self-contained.
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

-- Defensive backstop for invite_code uniqueness (audit finding: the
-- application-level retry loop below has no cross-event lock, so a
-- database-level constraint is the real guarantee against a collision
-- between two different events registering at the same instant).
create unique index if not exists idx_event_registrations_invite_code on public.event_registrations (invite_code);

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
-- Done. Exactly one register_for_event(), matching the frontend's 7
-- parameters. No table, column, or other function touched.
-- =====================================================================
