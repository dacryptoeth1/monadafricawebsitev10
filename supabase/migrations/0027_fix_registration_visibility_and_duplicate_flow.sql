-- =====================================================================
-- Monad Africa — 0027: Fix registration visibility + duplicate flow
-- Run in Supabase SQL Editor AFTER 0001-0026.
--
-- ROOT CAUSE (found by code + live-API inspection, confirmed against
-- your diagnostic queries):
--
-- 1. No migration ever granted base table-level SELECT on
--    event_registrations to the `authenticated` role. RLS policies only
--    ever narrow rows on top of a table-level grant — they never
--    substitute for one. `events` got this exact fix in 0026 for `anon`;
--    `event_registrations` never got the equivalent for `authenticated`.
--    register_for_event()'s duplicate check runs as SECURITY DEFINER,
--    which bypasses both the grant and RLS — so it can always see every
--    row. An ordinary `select('*')` from the browser (admin dashboard
--    included) cannot, unless it has the grant. This is the direct
--    explanation for "duplicate detected, but admin shows 0".
--
-- 2. register_for_event()'s duplicate branch only ever did
--    `raise exception 'DUPLICATE_EMAIL: ...'` — it never looked up or
--    returned the caller's existing invite code. The frontend only ever
--    sends the confirmation/resend email after a *successful* RPC
--    return, so a second registration attempt could never result in an
--    email, regardless of anything else. This file changes the
--    duplicate branch to return the existing registration (with
--    is_new = false) instead of raising, so the caller gets their real
--    invite code back and can resend it.
--
-- Nothing here touches existing data, drops a table, or weakens any
-- existing access — it only adds a missing grant, adds one new
-- read policy scoped to a user's own rows, and changes what
-- register_for_event() returns on the already-registered path.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Missing table-level grant — the actual root cause of "admin sees
--    0 registrations". Additive only; the existing RLS policies below
--    still fully control which rows any given role can actually read.
-- ---------------------------------------------------------------------
grant select on public.event_registrations to authenticated;

-- ---------------------------------------------------------------------
-- 2. Let a signed-in user see their own registration rows (not just
--    admins). This does not weaken admin access — Postgres combines
--    multiple permissive policies with OR, so admins keep seeing
--    everything via the existing "admins view registrations" policy.
-- ---------------------------------------------------------------------
drop policy if exists "users view own registrations" on public.event_registrations;
create policy "users view own registrations" on public.event_registrations for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. register_for_event(): duplicate path now returns the existing
--    registration (is_new = false) instead of raising an exception.
--    Signature (input parameters) is unchanged; the output column list
--    gains one new boolean column, which Postgres does not allow via
--    CREATE OR REPLACE (it errors: "cannot change return type of
--    existing function") — so this drops and recreates it.
-- ---------------------------------------------------------------------
drop function if exists public.register_for_event(uuid, text, text, text, text, text, text);

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
  event_location text,
  is_new boolean
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

  -- Already registered (by this user, for this event): return their
  -- existing registration instead of raising, so the caller can always
  -- retrieve/resend the real invite code that was already issued.
  if exists (select 1 from public.event_registrations where event_id = p_event_id and user_id = v_user_id) then
    return query
      select er.id, er.invite_code, v_event.title, v_event.event_date, v_event.start_time, v_event.location, false
      from public.event_registrations er
      where er.event_id = p_event_id and er.user_id = v_user_id;
    return;
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
    exit when not exists (select 1 from public.event_registrations er where er.invite_code = v_code);
    if v_attempts > 20 then
      raise exception 'Could not generate a unique invite code — please try again';
    end if;
  end loop;

  insert into public.event_registrations (event_id, user_id, full_name, email, country, twitter, phone, wallet_address, invite_code)
  values (p_event_id, v_user_id, trim(p_full_name), v_email, trim(p_country), nullif(trim(p_twitter), ''), nullif(trim(p_phone), ''), nullif(trim(p_wallet_address), ''), v_code)
  returning id into v_reg_id;

  return query select v_reg_id, v_code, v_event.title, v_event.event_date, v_event.start_time, v_event.location, true;
end;
$$;

revoke all on function public.register_for_event(uuid, text, text, text, text, text, text) from public;
revoke all on function public.register_for_event(uuid, text, text, text, text, text, text) from anon;
grant execute on function public.register_for_event(uuid, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. Added: one table grant, one new SELECT policy (own rows only),
-- and register_for_event()'s duplicate path now returns data instead
-- of raising. No table dropped, no row touched, no existing admin
-- access removed.
-- =====================================================================
