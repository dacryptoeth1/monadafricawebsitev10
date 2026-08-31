-- =====================================================================
-- Monad Africa — 0018: Restore profiles.full_name (schema-first fix)
-- Run in Supabase SQL Editor AFTER 0001-0017.
--
-- WHY THIS FILE EXISTS: 0017 removed every application reference to
-- profiles.full_name because the live database was missing that
-- column. That's been reversed — the correct fix is to make the
-- database match what the Edit Profile page actually needs, not strip
-- the field out of the app. This file adds full_name back (plain
-- `text`, no constraint — matches its original 0001 definition), and
-- defensively re-verifies every other column the Edit Profile page
-- reads/writes actually exists, using ADD COLUMN IF NOT EXISTS
-- throughout so this is a pure, idempotent, non-destructive addition —
-- no table is dropped, no existing column is altered or removed, and
-- no existing row's data is touched other than getting NULL in the
-- newly-added full_name column (exactly like any other ADD COLUMN).
-- =====================================================================

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists username text unique,
  add column if not exists email text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists role text check (role in ('Developer','Designer','Content Creator','Community Member','Founder','Student')),
  add column if not exists bio text,
  add column if not exists twitter text,
  add column if not exists telegram text,
  add column if not exists discord text,
  add column if not exists website text,
  add column if not exists github text,
  add column if not exists wallet_address text,
  add column if not exists wallet_provider text,
  add column if not exists avatar_url text;

-- ---------------------------------------------------------------------
-- Re-point handle_new_user() (the signup trigger) and apply_to_bounty()
-- back at profiles.full_name now that the column genuinely exists —
-- both were rewritten by 0017 to drop it; this restores their original
-- 0010 behavior verbatim.
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
      perform public.grant_xp(referrer.id, public.xp_reward('referral'), 'referral_bonus');
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit and ' || public.xp_reward('referral') || ' XP.');
    end if;
  end if;

  return new;
end;
$$;

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
  v_is_first boolean;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.is_suspended then
    raise exception 'Account suspended';
  end if;
  if v_profile.is_banned then
    raise exception 'Account banned';
  end if;
  if v_profile.credits <= 0 then
    raise exception 'No credits remaining — you need at least 1 credit to apply';
  end if;

  select * into v_bounty from public.bounties where id = p_bounty_id;
  if not found or v_bounty.status <> 'approved' or v_bounty.is_closed then
    raise exception 'Bounty is not open for applications';
  end if;

  if exists (select 1 from public.applications where bounty_id = p_bounty_id and user_id = auth.uid()) then
    raise exception 'You have already applied to this bounty';
  end if;

  v_is_first := not exists (select 1 from public.applications where user_id = auth.uid());

  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.full_name, v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
  returning * into v_application;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = credits - 1 where id = auth.uid();

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), -1, 'bounty_application:' || p_bounty_id::text);

  perform public.grant_xp(auth.uid(), public.xp_reward('first_submission') / 5, 'bounty_application:' || p_bounty_id::text);

  if v_is_first and not v_profile.first_submission_bonus_awarded then
    perform public.grant_xp(auth.uid(), public.xp_reward('first_submission'), 'first_submission_bonus');
    perform set_config('app.bypass_profile_protection', 'true', true);
    update public.profiles set first_submission_bonus_awarded = true where id = auth.uid();
    insert into public.notifications (user_id, type, title, message)
    values (auth.uid(), 'xp_awarded', 'First submission bonus!', 'You earned an extra ' || public.xp_reward('first_submission') || ' XP for your first bounty application.');
  end if;

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-assert RLS (no-op if already correct — same policies as 0014,
-- unchanged). Included so a fresh/self-healing install stays fully
-- consistent; existing policies, auth, and user IDs are untouched.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles viewable by owner or admin" on public.profiles;
create policy "profiles viewable by owner or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles insertable by owner" on public.profiles;
create policy "profiles insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles editable by owner or admin" on public.profiles;
create policy "profiles editable by owner or admin"
  on public.profiles for update
  using ((auth.uid() = id and is_suspended = false and is_banned = false) or public.is_admin());

-- ---------------------------------------------------------------------
-- Force PostgREST to drop its cached schema and pick up the new column
-- immediately, rather than waiting on auto-detection (same fix 0014
-- used for this exact class of "column ... does not exist" error).
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table dropped, no existing column altered/removed, no user
-- data touched or reset. profiles.full_name now exists for real.
-- =====================================================================
