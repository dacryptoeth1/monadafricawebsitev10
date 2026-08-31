-- =====================================================================
-- Monad Africa — 0004: Profile extras + credit system overhaul
-- Run in Supabase SQL Editor AFTER 0001, 0002, 0003.
-- Self-contained: uses IF NOT EXISTS / OR REPLACE throughout so it's
-- safe to run more than once and doesn't assume anything beyond what
-- 0001-0003 already guarantee.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fix an interaction bug with the 0003 protection trigger: that trigger
-- reverts changes to credits/referral fields unless `is_admin()` is
-- true — but `auth.uid()` inside a SECURITY DEFINER function still
-- reflects the original (non-admin) caller, so it would silently
-- cancel the credit deduction inside apply_to_bounty() below. Fix: the
-- trigger also allows the change when a transaction-local flag is set,
-- which only the trusted functions in this file ever set.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and coalesce(current_setting('app.bypass_profile_protection', true), '') <> 'true' then
    new.credits := old.credits;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.total_referrals := old.total_referrals;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- PROFILES: new editable fields + suspension flag
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists bio text,
  add column if not exists region text,
  add column if not exists twitter text,
  add column if not exists telegram text,
  add column if not exists discord text,
  add column if not exists website text,
  add column if not exists is_suspended boolean not null default false;

-- Credits must never go negative, whatever writes to this column.
alter table public.profiles drop constraint if exists profiles_credits_non_negative;
alter table public.profiles add constraint profiles_credits_non_negative check (credits >= 0);

-- Suspended users should not be able to write anything meaningful even
-- though they can still read (keeps their dashboard visible/read-only).
drop policy if exists "profiles editable by owner or admin" on public.profiles;
create policy "profiles editable by owner or admin"
  on public.profiles for update
  using ((auth.uid() = id and is_suspended = false) or public.is_admin());

-- ---------------------------------------------------------------------
-- New signups now get 3 credits (was 5) — update both the column
-- default and the signup trigger.
-- ---------------------------------------------------------------------
alter table public.profiles alter column credits set default 3;

-- ---------------------------------------------------------------------
-- CREDIT TRANSACTIONS  (full history — every credit change is logged
-- here by the functions below, never written to directly by clients)
-- ---------------------------------------------------------------------
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null, -- positive = credit added, negative = credit spent
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_transactions_user on public.credit_transactions (user_id);

alter table public.credit_transactions enable row level security;

drop policy if exists "users view own credit history" on public.credit_transactions;
create policy "users view own credit history"
  on public.credit_transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- No insert/update/delete policies for regular clients — every row is
-- written by a SECURITY DEFINER function below.

-- ---------------------------------------------------------------------
-- Re-create the signup trigger to: grant 3 credits (not 5), and log
-- that grant + any referral bonus to credit_transactions.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  referrer public.profiles%rowtype;
begin
  insert into public.profiles (id, full_name, username, email, country, role, credits, referral_code)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    3,
    public.generate_referral_code()
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, 3, 'signup_bonus');

  ref_code := new.raw_user_meta_data->>'referred_by_code';
  if ref_code is not null and ref_code <> '' then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found then
      update public.profiles set referred_by = referrer.id where id = new.id;
      perform set_config('app.bypass_profile_protection', 'true', true);
      update public.profiles
        set credits = credits + 1, total_referrals = total_referrals + 1
        where id = referrer.id;
      insert into public.credit_transactions (user_id, amount, reason)
      values (referrer.id, 1, 'referral_bonus');
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit.');
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: apply_to_bounty()
-- Replaces direct client INSERTs into `applications`. Atomically checks
-- the bounty is open, the user isn't suspended, hasn't already applied,
-- and has at least 1 credit — then inserts the application, deducts the
-- credit, and logs it. All in one transaction so it can't be raced or
-- bypassed by calling the table directly (direct insert is no longer
-- permitted — see the dropped policy below).
-- ---------------------------------------------------------------------
create or replace function public.apply_to_bounty(
  p_bounty_id uuid,
  p_portfolio_link text,
  p_message text
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_bounty public.bounties%rowtype;
  v_application public.applications%rowtype;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.is_suspended then
    raise exception 'Account suspended';
  end if;
  if v_profile.credits <= 0 then
    raise exception 'No credits remaining — you need at least 1 credit to apply';
  end if;

  select * into v_bounty from public.bounties where id = p_bounty_id;
  if not found or v_bounty.status <> 'approved' then
    raise exception 'Bounty is not open for applications';
  end if;

  if exists (select 1 from public.applications where bounty_id = p_bounty_id and user_id = auth.uid()) then
    raise exception 'You have already applied to this bounty';
  end if;

  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.full_name, v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
  returning * into v_application;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = credits - 1 where id = auth.uid();

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), -1, 'bounty_application:' || p_bounty_id::text);

  return v_application;
end;
$$;

-- Applications can no longer be inserted directly by clients — only via
-- the RPC above, which is what actually enforces the credit deduction.
drop policy if exists "signed-in users can apply as themselves" on public.applications;
drop policy if exists "anyone can apply to a bounty" on public.applications;

-- ---------------------------------------------------------------------
-- RPC: admin_adjust_credits()  — admin only
-- For manual corrections from the admin Users tab. Clamped at 0.
-- ---------------------------------------------------------------------
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can adjust credits';
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles
  set credits = greatest(0, credits + p_amount)
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  insert into public.credit_transactions (user_id, amount, reason)
  values (p_user_id, p_amount, coalesce(nullif(p_reason, ''), 'admin_adjustment'));

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: admin_set_suspended()  — admin only
-- ---------------------------------------------------------------------
create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can suspend accounts';
  end if;

  update public.profiles set is_suspended = p_suspended where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: admin_set_moderator()  — admin only. Adds/removes a user from
-- the admins allowlist (this is what "moderator" access means here).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_moderator(p_user_id uuid, p_is_moderator boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage moderators';
  end if;

  if p_is_moderator then
    insert into public.admins (id) values (p_user_id) on conflict (id) do nothing;
  else
    delete from public.admins where id = p_user_id;
  end if;
end;
$$;

-- =====================================================================
-- Done.
-- =====================================================================
