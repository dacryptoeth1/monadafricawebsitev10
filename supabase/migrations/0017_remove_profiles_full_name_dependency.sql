-- =====================================================================
-- Monad Africa — 0017: Remove all dependency on profiles.full_name
-- Run in Supabase SQL Editor AFTER 0001-0016.
--
-- WHY THIS FILE EXISTS: saving a profile fails with
--   "column \"full_name\" of relation \"profiles\" does not exist"
-- On this project's live database, public.profiles genuinely has no
-- full_name column (unlike what 0001/0002/0014 defined) — the same
-- kind of live/migration drift already seen with event_listings and
-- credit_ledger. Per instruction, this file does NOT recreate that
-- column just to silence the error — it removes every server-side
-- reference to profiles.full_name instead, so the database matches
-- what the application actually needs: `username` is the one real,
-- reliably-present display-name field on profiles.
--
-- Two functions are affected:
--   1. handle_new_user() — the signup trigger — tried to INSERT a
--      full_name value into profiles. Since that column doesn't exist,
--      EVERY new signup has been failing at the trigger level, not
--      just profile edits. Fixed by dropping full_name from the
--      INSERT column/value lists.
--   2. apply_to_bounty() — read v_profile.full_name (a %rowtype field)
--      when copying the applicant's display name onto the new
--      applications row (applications.full_name is a real, unrelated
--      column on a different table and is untouched). Fixed to read
--      only v_profile.username.
-- protect_profile_fields() is re-declared here too, defensively,
-- exactly as it already exists in 0004 (credits/referral_code/
-- referred_by/total_referrals only) — it never referenced full_name in
-- any version of this migration history, but is re-asserted in case
-- the live copy diverged the same way the two functions above did.
-- No table is altered and no column is added or removed by this file.
-- =====================================================================

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
  insert into public.profiles (id, username, email, country, role, credits, referral_code)
  values (
    new.id,
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

  -- applications.full_name is a real column on a different table
  -- (unrelated to profiles.full_name) — only the source expression
  -- changes here, from coalesce(v_profile.full_name, v_profile.username, '')
  -- to just v_profile.username, since profiles has no full_name column.
  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
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

-- Defensive re-assertion — unchanged in substance from 0004, never
-- referenced full_name, re-declared here in case the live copy drifted.
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

-- =====================================================================
-- Done. No table altered. profiles.full_name is not created or
-- referenced anywhere in this file.
-- =====================================================================
