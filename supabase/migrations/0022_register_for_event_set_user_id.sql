-- =====================================================================
-- Monad Africa — 0022: register_for_event() must set user_id
-- Run in Supabase SQL Editor AFTER 0001-0021.
--
-- WHY THIS FILE EXISTS: registration fails with a generic
-- "Something went wrong submitting your registration" message.
-- Confirmed root cause (via information_schema.columns, not a guess):
-- public.event_registrations.user_id is NOT NULL with no default, but
-- register_for_event()'s INSERT never included user_id at all — every
-- call, from any caller, fails a not-null constraint. This file only
-- changes that one function's body:
--   1. Reads auth.uid() and requires it — registering for an event now
--      requires being signed in, matching the table's actual
--      constraint (there is no way to satisfy a NOT NULL user_id for
--      a visitor who has no account). An anonymous caller gets a clear
--      "VALIDATION: Please sign in to register for this event."
--      message instead of a raw database error — the existing frontend
--      error handling (friendlyRegistrationError in
--      EventRegistrationModal.tsx) already displays VALIDATION:
--      messages directly, so no frontend change is needed for this.
--   2. Includes user_id in the INSERT.
--   3. Checks for an existing (event_id, user_id) registration instead
--      of an email-based check, matching the table's real unique
--      constraint (event_registrations_event_id_user_id_key) instead
--      of the email-uniqueness assumption from the original design.
-- No table, column, or constraint is changed. No other function is
-- touched. No existing registration row is modified.
-- =====================================================================

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
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'VALIDATION: Please sign in to register for this event.';
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

-- =====================================================================
-- Done. Only register_for_event()'s body changed. No table, column,
-- constraint, policy, or other function was touched.
-- =====================================================================
