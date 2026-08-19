-- =====================================================================
-- Monad Africa — 0033: Event email verification + per-account invite
-- codes.
-- Run in Supabase SQL Editor AFTER 0001-0032.
--
-- WHY THIS FILE EXISTS: register_for_event() (0016) already hands out
-- an invite code the instant someone fills in the registration form —
-- that code is tied to a free-text email typed into the form, with no
-- proof the registrant actually controls that inbox. This migration
-- adds a SEPARATE, OPT-IN (per event, via a new
-- events.requires_email_verification flag) system: a logged-in user
-- proves they control THEIR ACCOUNT's email via a one-time 6-digit
-- code before receiving a personal invite code tied to their account
-- (auth.uid()) and that event. It does not touch events,
-- event_registrations, register_for_event, or any existing
-- registration/check-in behavior — every existing event keeps working
-- exactly as before with requires_email_verification defaulting to
-- false.
--
-- New tables:
--   event_email_verifications — one row per (user, event). Holds only
--     a salted SHA-256 hash of the current code, never the code
--     itself. Overwritten (not appended) on every resend, so there is
--     never more than one live code per user+event.
--   event_invite_codes — one row per (user, event) once verified.
--     unique(user_id, event_id) is the hard backstop against ever
--     issuing a second active code to the same account for the same
--     event, no matter how many times the flow is re-run or the page
--     is refreshed.
--
-- All sensitive work (generating the code, hashing it, comparing a
-- guess, sending the email) happens in the two new Netlify Functions
-- (netlify/functions/event-verify-request.ts,
-- netlify/functions/event-verify-confirm.ts) using the service-role
-- key — the exact same pattern this codebase already uses for
-- send-invite-email.ts. Neither new table grants any INSERT/UPDATE to
-- anon/authenticated; only a service-role client (or a SECURITY
-- DEFINER function, see below) can write to them, so a signed-in user
-- cannot fabricate a "verified" row or an invite code by calling the
-- REST API directly.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EVENTS: one new, additive, defaulted column. No existing row's
--    behavior changes — every event that already exists gets
--    requires_email_verification = false, i.e. "keep behaving exactly
--    like today."
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists requires_email_verification boolean not null default false;

-- ---------------------------------------------------------------------
-- 2. EVENT_EMAIL_VERIFICATIONS
-- ---------------------------------------------------------------------
create table if not exists public.event_email_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null,
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_email_verifications_user_event_key unique (user_id, event_id)
);

create index if not exists idx_event_email_verifications_event on public.event_email_verifications (event_id);

drop trigger if exists trg_event_email_verifications_updated_at on public.event_email_verifications;
create trigger trg_event_email_verifications_updated_at before update on public.event_email_verifications
  for each row execute function public.set_updated_at();

alter table public.event_email_verifications enable row level security;

-- No select/insert/update policy for anon/authenticated at all — this
-- table holds a code_hash + salt, which nothing client-side ever needs
-- to read. All writes go through the Netlify Functions' service-role
-- client (bypasses RLS entirely, same as send-invite-email.ts already
-- does for event_registrations). The one read a signed-in user needs
-- ("is my code still pending / did I already verify") is served by
-- get_event_verification_status() below, a SECURITY DEFINER function
-- that returns only safe, derived fields — never code_hash or salt.
drop policy if exists "admins view event verifications" on public.event_email_verifications;
create policy "admins view event verifications" on public.event_email_verifications for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. EVENT_INVITE_CODES
-- ---------------------------------------------------------------------
create table if not exists public.event_invite_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  invite_code text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  constraint event_invite_codes_invite_code_key unique (invite_code),
  -- The actual "never more than one active code per user per event"
  -- guarantee: a second attempt to insert for the same (user_id,
  -- event_id) fails at the database level regardless of what any
  -- application code does or how many times a request races itself.
  constraint event_invite_codes_user_event_key unique (user_id, event_id)
);

create index if not exists idx_event_invite_codes_event on public.event_invite_codes (event_id);

alter table public.event_invite_codes enable row level security;

-- A user may read their OWN invite code (and only their own); admins
-- may read all. No insert/update/delete policy for anon/authenticated
-- — issuance happens exclusively inside event-verify-confirm.ts via
-- the service-role client, only after a code hash has matched.
drop policy if exists "users view own invite code" on public.event_invite_codes;
create policy "users view own invite code" on public.event_invite_codes for select
  using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------
-- 4. INVITE CODE GENERATOR for this feature specifically — deliberately
--    a distinct format (MONAD-XXXXXX) from generate_invite_code()'s
--    MONAF-XXXX-XXXX (used by the unrelated instant-registration
--    flow), so the two code series are never visually confusable by an
--    admin or a user holding both. Same CSPRNG approach (bytes from
--    gen_random_uuid(), no extension dependency) as generate_invite_code().
-- ---------------------------------------------------------------------
create or replace function public.generate_event_verification_invite_code()
returns text language plpgsql as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  alen constant int := length(alphabet);
  raw bytea;
  code text := '';
  i int;
begin
  raw := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(raw, i) % alen) + 1, 1);
  end loop;
  return 'MONAD-' || code;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. READ-ONLY STATUS CHECK for the signed-in user's own verification
--    state on one event. Safe to call directly from the client
--    (supabase.rpc) — it never returns code_hash/salt, only derived
--    booleans/the invite code once issued (which already belongs to
--    this exact caller, enforced via auth.uid() rather than a
--    client-supplied id). This is what makes "refresh the page and see
--    the same invite code" work without regenerating anything: it's a
--    pure read, it never inserts or updates.
-- ---------------------------------------------------------------------
create or replace function public.get_event_verification_status(p_event_id uuid)
returns table (
  verified boolean,
  invite_code text,
  has_pending_code boolean,
  pending_expires_at timestamptz,
  account_email text
)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;
  return query
    select
      (ic.id is not null) as verified,
      ic.invite_code,
      (ev.id is not null and not ev.verified and ev.expires_at > now()) as has_pending_code,
      case when ev.id is not null and not ev.verified and ev.expires_at > now() then ev.expires_at else null end,
      (select email from auth.users where id = v_uid)
    from (select 1) dummy
    left join public.event_invite_codes ic on ic.user_id = v_uid and ic.event_id = p_event_id and ic.status = 'active'
    left join public.event_email_verifications ev on ev.user_id = v_uid and ev.event_id = p_event_id;
end;
$$;
revoke all on function public.get_event_verification_status(uuid) from public;
grant execute on function public.get_event_verification_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. ADMIN: aggregate stats + per-code listing for the admin dashboard's
--    Event Registrations section. Column selection deliberately never
--    includes code_hash/salt (admins should not need, and are not
--    shown, the OTP itself — only that verification happened and when).
-- ---------------------------------------------------------------------
create or replace function public.admin_event_verification_stats(p_event_id uuid)
returns table (
  total_verification_attempts integer,
  verified_count integer,
  invite_codes_issued integer
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  return query
    select
      (select count(*)::int from public.event_email_verifications where event_id = p_event_id),
      (select count(*)::int from public.event_email_verifications where event_id = p_event_id and verified),
      (select count(*)::int from public.event_invite_codes where event_id = p_event_id and status = 'active');
end;
$$;
revoke all on function public.admin_event_verification_stats(uuid) from public;
grant execute on function public.admin_event_verification_stats(uuid) to authenticated;

create or replace function public.admin_list_event_invite_codes(p_event_id uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  invite_code text,
  status text,
  verified_at timestamptz,
  created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  return query
    select ic.user_id, ev.email, p.full_name, ic.invite_code, ic.status, ev.verified_at, ic.created_at
    from public.event_invite_codes ic
    left join public.event_email_verifications ev on ev.user_id = ic.user_id and ev.event_id = ic.event_id
    left join public.profiles p on p.id = ic.user_id
    where ic.event_id = p_event_id
    order by ic.created_at desc;
end;
$$;
revoke all on function public.admin_list_event_invite_codes(uuid) from public;
grant execute on function public.admin_list_event_invite_codes(uuid) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. events, event_registrations, register_for_event(),
-- generate_invite_code(), and every existing RLS policy are untouched.
-- Every existing event defaults to requires_email_verification = false
-- and keeps behaving exactly as it did before this migration.
-- =====================================================================
