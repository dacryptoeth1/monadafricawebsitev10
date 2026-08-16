-- =====================================================================
-- Monad Africa — 0025: Fix ambiguous "invite_code" reference (42702)
-- Run in Supabase SQL Editor AFTER 0001-0024.
--
-- WHY THIS FILE EXISTS: registration now fails with
--   ERROR: 42702: column reference "invite_code" is ambiguous
-- register_for_event() declares `returns table (..., invite_code
-- text, ...)`, which makes `invite_code` an implicit variable visible
-- throughout the function body. One line referenced the bare column
-- name from event_registrations directly instead of through a
-- qualified alias, colliding with that return-table variable:
--   exit when not exists (select 1 from public.event_registrations
--     where invite_code = v_code);
-- This file re-creates the function with that single line qualified
-- via a table alias (er.invite_code) — the only change. Every other
-- line was already unambiguous (all other table access goes through
-- the qualified v_event row variable). No table, column, or grant is
-- touched; the function's signature is unchanged, so no existing
-- caller or overload is affected.
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
    -- Fixed: qualified via alias "er" so this can't collide with the
    -- invite_code return-table variable declared above.
    exit when not exists (select 1 from public.event_registrations er where er.invite_code = v_code);
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

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. Only register_for_event()'s body changed (one line qualified).
-- No table, column, grant, or other function touched.
-- =====================================================================
