-- =====================================================================
-- Monad Africa — Event Registration & Invite Verification System
-- Adds NEW tables only: event_listings, event_registrations.
-- Does NOT touch the existing public.events table (homepage announcement
-- feed) or any other existing table/column/policy.
-- Run once in Supabase Dashboard → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- EVENT LISTINGS (rich events that support registration + check-in)
-- ---------------------------------------------------------------------
create table if not exists public.event_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  image_url text,
  event_url text,
  capacity integer check (capacity is null or capacity > 0),
  registration_deadline timestamptz,
  registration_open boolean not null default true,
  status text not null default 'published' check (status in ('draft','published','cancelled')),
  created_by uuid references public.admins (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_listings_status_date on public.event_listings (status, event_date);

-- ---------------------------------------------------------------------
-- EVENT REGISTRATIONS
-- ---------------------------------------------------------------------
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.event_listings (id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  constraint event_registrations_invite_code_key unique (invite_code),
  constraint event_registrations_email_format check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- The real duplicate-prevention backstop (event_id + case-insensitive email).
create unique index if not exists idx_event_registrations_event_email on public.event_registrations (event_id, lower(email));
create index if not exists idx_event_registrations_event on public.event_registrations (event_id);
create index if not exists idx_event_registrations_invite_code on public.event_registrations (invite_code);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_event_listings_updated_at on public.event_listings;
create trigger trg_event_listings_updated_at before update on public.event_listings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_event_registrations_updated_at on public.event_registrations;
create trigger trg_event_registrations_updated_at before update on public.event_registrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.event_listings enable row level security;
alter table public.event_registrations enable row level security;

drop policy if exists "published events are public" on public.event_listings;
create policy "published events are public" on public.event_listings for select
  using (status <> 'draft' or public.is_admin());
drop policy if exists "admins insert events" on public.event_listings;
create policy "admins insert events" on public.event_listings for insert with check (public.is_admin());
drop policy if exists "admins update events" on public.event_listings;
create policy "admins update events" on public.event_listings for update using (public.is_admin());
drop policy if exists "admins delete events" on public.event_listings;
create policy "admins delete events" on public.event_listings for delete using (public.is_admin());

-- No insert policy on event_registrations for anon/authenticated on purpose:
-- every insert must go through register_for_event() below, a SECURITY
-- DEFINER function that enforces validation/capacity/duplicate checks and
-- bypasses RLS itself. A visitor cannot POST straight to this table.
drop policy if exists "admins view registrations" on public.event_registrations;
create policy "admins view registrations" on public.event_registrations for select using (public.is_admin());
drop policy if exists "admins update registrations" on public.event_registrations;
create policy "admins update registrations" on public.event_registrations for update using (public.is_admin());

-- ---------------------------------------------------------------------
-- INVITE CODE GENERATOR
-- Format: MONAF-XXXX-XXXX, alphabet excludes 0/O/1/I/L to avoid
-- ambiguity when read aloud/typed at check-in. Entropy comes from
-- gen_random_uuid() (OS CSPRNG, built into Postgres — no pgcrypto
-- dependency/schema ambiguity). Never derived from name/email/wallet.
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
  -- decode()/get_byte() are core Postgres builtins (no extension, no
  -- schema-resolution ambiguity) — turns the UUID's hex text into raw
  -- bytes so each byte can be mapped into the alphabet below.
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
-- PUBLIC: registration count only (no PII) — lets the events page show
-- "87/100 registered" without granting any read access to attendees.
-- ---------------------------------------------------------------------
create or replace function public.event_registration_count(p_event_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.event_registrations where event_id = p_event_id;
$$;
revoke all on function public.event_registration_count(uuid) from public;
grant execute on function public.event_registration_count(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- PUBLIC: register for an event. All validation, capacity, deadline,
-- duplicate-email, and invite-code generation happen here — server
-- side, inside one transaction. `for update` locks the event row so
-- two concurrent submissions can't both slip into the last spot; the
-- unique index above is the hard backstop either way.
-- ---------------------------------------------------------------------
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
  v_event public.event_listings;
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

  select * into v_event from public.event_listings where id = p_event_id for update;
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

-- ---------------------------------------------------------------------
-- ADMIN: look up an invite code (read-only, for the check-in screen's
-- "search" step before the admin confirms check-in).
-- ---------------------------------------------------------------------
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
    from public.event_registrations r join public.event_listings e on e.id = r.event_id
    where r.invite_code = upper(trim(p_code));
end;
$$;
revoke all on function public.admin_lookup_invite_code(text) from public;
grant execute on function public.admin_lookup_invite_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- ADMIN: check a code in. Idempotent — a second call on an
-- already-checked-in code returns already_checked_in=true with the
-- ORIGINAL timestamp, it never overwrites it. Records which admin
-- performed the check-in via auth.uid() (never trusts a client-passed id).
-- ---------------------------------------------------------------------
create or replace function public.admin_check_in_registration(p_code text)
returns table (
  registration_id uuid, full_name text, email text, event_title text, event_date date,
  already_checked_in boolean, checked_in_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  v_reg public.event_registrations;
  v_event public.event_listings;
  v_was_checked_in boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_reg from public.event_registrations where invite_code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'INVALID_CODE: No registration found for this invite code';
  end if;

  select * into v_event from public.event_listings where id = v_reg.event_id;
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
