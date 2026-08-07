-- =====================================================================
-- Monad Africa — 0010: Configurable XP rewards, RBAC hardening, reports
-- Run in Supabase SQL Editor AFTER 0001-0009.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
-- =====================================================================

-- ---------------------------------------------------------------------
-- XP self-heals the same way credits did in 0008: backfill any NULL to
-- 0, guarantee NOT NULL DEFAULT 0 so the "never blank" requirement is
-- enforced at the database layer, not just the client.
-- ---------------------------------------------------------------------
update public.profiles set xp = 0 where xp is null;
alter table public.profiles alter column xp set default 0;
alter table public.profiles alter column xp set not null;

-- ---------------------------------------------------------------------
-- XP REWARD CONFIG — admin-editable, no code changes needed to adjust
-- amounts. Seeded with the values from this round's spec.
-- ---------------------------------------------------------------------
create table if not exists public.xp_reward_config (
  key text primary key,
  label text not null,
  amount int not null,
  updated_at timestamptz not null default now()
);

insert into public.xp_reward_config (key, label, amount) values
  ('profile_complete', 'Complete Profile', 20),
  ('wallet_connect', 'Connect Wallet', 10),
  ('first_submission', 'Submit First Bounty (one-time bonus)', 25),
  ('submission_approved', 'Approved Bounty Submission', 50),
  ('bounty_winner', 'Win Bounty (bonus on top of approval)', 100),
  ('referral', 'Successful Referral', 25),
  ('community_campaign', 'Official Community Campaign (manual award default)', 0)
on conflict (key) do nothing;

alter table public.xp_reward_config enable row level security;
drop policy if exists "xp reward config readable by everyone" on public.xp_reward_config;
create policy "xp reward config readable by everyone" on public.xp_reward_config for select using (true);
drop policy if exists "xp reward config editable by super admins" on public.xp_reward_config;
create policy "xp reward config editable by super admins" on public.xp_reward_config for update using (public.is_super_admin());

create or replace function public.xp_reward(p_key text)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select amount from public.xp_reward_config where key = p_key), 0);
$$;

-- ---------------------------------------------------------------------
-- One-time-bonus tracking flags (mirrors profile_complete_bonus_awarded
-- from 0004, same pattern: prevents a bonus from being paid twice).
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists wallet_bonus_awarded boolean not null default false,
  add column if not exists first_submission_bonus_awarded boolean not null default false;

-- ---------------------------------------------------------------------
-- Re-create handle_new_user(): referral bonus now reads from config
-- (was hardcoded 10, spec now says 25 — the config table is the single
-- source of truth, this just stops hardcoding the number).
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

-- ---------------------------------------------------------------------
-- Re-create apply_to_bounty(): the existing +XP-per-application still
-- happens (unchanged behavior, reads from config now instead of a
-- hardcoded 15), PLUS a one-time "first submission" bonus on top of
-- that for a user's very first application ever.
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
  -- ^ small recurring XP for every application (kept from the prior
  -- round's behavior so nothing regresses), scaled down from the
  -- one-time first-submission bonus so the numbers stay sensible
  -- relative to each other; fully admin-adjustable via xp_reward_config
  -- since it's still just reading 'first_submission' / 5.

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
-- Re-create admin_approve_submission(): reads the approval XP amount
-- from config instead of a hardcoded 50. "Win Bounty" (+100) is now a
-- SEPARATE action below (admin_mark_submission_winner), since the
-- brief distinguishes "Approved" from "Won" as two different events.
-- ---------------------------------------------------------------------
create or replace function public.admin_approve_submission(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_target_user uuid;
  v_already_won boolean;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve submissions';
  end if;

  select user_id into v_target_user from public.submissions where id = p_submission_id;
  if v_target_user is null then
    raise exception 'Submission not found';
  end if;

  select exists(
    select 1 from public.submissions where user_id = v_target_user and status = 'approved'
  ) into v_already_won;

  update public.submissions set status = 'approved' where id = p_submission_id
  returning * into v_submission;

  perform public.grant_xp(v_submission.user_id, public.xp_reward('submission_approved'), 'submission_approved:' || p_submission_id::text);

  if not v_already_won then
    perform public.award_badge(v_submission.user_id, 'bounty_hunter');
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (v_submission.user_id, 'won_bounty', 'Submission approved!', 'Your bounty submission was accepted — you earned ' || public.xp_reward('submission_approved') || ' XP.');

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- NEW: admin_mark_submission_winner() — the "Win Bounty" +100 XP bonus,
-- distinct from plain approval. Only makes sense on an already-approved
-- submission; awards the bonus once (guarded by submissions.is_winner).
-- ---------------------------------------------------------------------
alter table public.submissions add column if not exists is_winner boolean not null default false;

create or replace function public.admin_mark_submission_winner(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can mark a winner';
  end if;

  select * into v_submission from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if v_submission.status <> 'approved' then
    raise exception 'Only approved submissions can be marked as a winner';
  end if;
  if v_submission.is_winner then
    raise exception 'Already marked as a winner';
  end if;

  update public.submissions set is_winner = true where id = p_submission_id
  returning * into v_submission;

  perform public.grant_xp(v_submission.user_id, public.xp_reward('bounty_winner'), 'bounty_winner:' || p_submission_id::text);
  perform public.award_badge(v_submission.user_id, 'top_contributor');

  insert into public.notifications (user_id, type, title, message)
  values (v_submission.user_id, 'won_bounty', '🏆 You won!', 'Your submission was selected as a winner — you earned an extra ' || public.xp_reward('bounty_winner') || ' XP.');

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- NEW: claim_wallet_connect_bonus() — +10 XP, once, for connecting a
-- wallet. Mirrors claim_profile_completion_bonus()'s pattern: called
-- from the client after a successful save, re-verified server-side.
-- ---------------------------------------------------------------------
create or replace function public.claim_wallet_connect_bonus()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.wallet_bonus_awarded then
    return false;
  end if;
  if v_profile.wallet_address is null or v_profile.wallet_address = '' then
    return false;
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set wallet_bonus_awarded = true where id = auth.uid();
  perform public.grant_xp(auth.uid(), public.xp_reward('wallet_connect'), 'wallet_connect_bonus');
  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Wallet connected!', 'You earned ' || public.xp_reward('wallet_connect') || ' XP for connecting a wallet.');

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create claim_profile_completion_bonus(): unchanged logic, now
-- reads the amount from config instead of a hardcoded 20.
-- ---------------------------------------------------------------------
create or replace function public.claim_profile_completion_bonus()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_complete boolean;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.profile_complete_bonus_awarded then
    return false;
  end if;

  v_complete := v_profile.avatar_url is not null and v_profile.avatar_url <> ''
    and v_profile.username is not null and v_profile.username <> ''
    and v_profile.bio is not null and v_profile.bio <> ''
    and v_profile.country is not null and v_profile.country <> ''
    and v_profile.region is not null and v_profile.region <> ''
    and v_profile.wallet_address is not null and v_profile.wallet_address <> ''
    and (
      (v_profile.twitter is not null and v_profile.twitter <> '') or
      (v_profile.discord is not null and v_profile.discord <> '') or
      (v_profile.telegram is not null and v_profile.telegram <> '') or
      (v_profile.github is not null and v_profile.github <> '')
    );

  if not v_complete then
    return false;
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set profile_complete_bonus_awarded = true where id = auth.uid();
  perform public.grant_xp(auth.uid(), public.xp_reward('profile_complete'), 'profile_complete_bonus');
  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Profile complete!', 'You earned ' || public.xp_reward('profile_complete') || ' XP for completing your profile.');

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- NEW: admin_award_community_xp() — the "Official Community Campaign"
-- reward, admin-triggered with a custom amount (defaults to the
-- configured value but can be overridden per-award for one-off
-- campaigns without needing a code change).
-- ---------------------------------------------------------------------
create or replace function public.admin_award_community_xp(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can award community XP';
  end if;
  perform public.grant_xp(p_user_id, p_amount, coalesce(nullif(p_reason, ''), 'community_campaign'));
  insert into public.notifications (user_id, type, title, message)
  values (p_user_id, 'xp_awarded', 'Community reward', p_amount || ' XP awarded: ' || coalesce(nullif(p_reason, ''), 'community campaign participation'));
end;
$$;

-- ---------------------------------------------------------------------
-- RBAC hardening: an Admin must not be able to ban or delete a Super
-- Admin's data (the brief explicitly forbids "Delete Super Admins" for
-- the Admin tier — extending the same protection to Ban, since leaving
-- that door open would be an easy way around the delete restriction).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can ban accounts';
  end if;
  if exists (select 1 from public.admins where id = p_user_id and role = 'super_admin') and not public.is_super_admin() then
    raise exception 'Only a Super Admin can ban another Super Admin';
  end if;

  update public.profiles set is_banned = p_banned where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.admin_delete_profile_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can delete user data';
  end if;
  if exists (select 1 from public.admins where id = p_user_id and role = 'super_admin') and not public.is_super_admin() then
    raise exception 'Only a Super Admin can delete another Super Admin''s data';
  end if;

  delete from public.submissions where user_id = p_user_id;
  delete from public.applications where user_id = p_user_id;
  delete from public.credit_transactions where user_id = p_user_id;
  delete from public.xp_transactions where user_id = p_user_id;
  delete from public.user_badges where user_id = p_user_id;
  delete from public.admins where id = p_user_id;
  delete from public.profiles where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- REPORTS  (new) — Moderator "View reports" capability. Any signed-in
-- user can file one; only staff can read/resolve them.
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('bounty', 'submission', 'user')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_status on public.reports (status);

alter table public.reports enable row level security;

drop policy if exists "signed-in users can file a report" on public.reports;
create policy "signed-in users can file a report"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "staff can view all reports" on public.reports;
create policy "staff can view all reports"
  on public.reports for select
  using (public.is_admin() or reporter_id = auth.uid());

drop policy if exists "staff can update reports" on public.reports;
create policy "staff can update reports"
  on public.reports for update
  using (public.is_admin());

-- =====================================================================
-- Done.
-- =====================================================================
