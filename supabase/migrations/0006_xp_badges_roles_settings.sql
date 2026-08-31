-- =====================================================================
-- Monad Africa — 0006: XP, Badges, Roles, Settings
-- Run in Supabase SQL Editor AFTER 0001-0005.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES: admins.role gains 'admin' as a distinct tier from
-- 'super_admin'/'moderator'. Ambassador/Member are lighter-weight
-- public-facing statuses, not admin-panel roles, so they live on
-- profiles instead (a badge, not a permission tier) — see is_ambassador
-- below. "Member" is just the default when neither applies.
-- ---------------------------------------------------------------------
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('super_admin', 'admin', 'moderator'));

alter table public.profiles
  add column if not exists is_ambassador boolean not null default false;

-- ---------------------------------------------------------------------
-- XP, wallet-completion tracking, notification preference
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists xp int not null default 0,
  add column if not exists profile_complete_bonus_awarded boolean not null default false,
  add column if not exists notifications_enabled boolean not null default true;

alter table public.profiles drop constraint if exists profiles_xp_non_negative;
alter table public.profiles add constraint profiles_xp_non_negative check (xp >= 0);

-- ---------------------------------------------------------------------
-- XP TRANSACTIONS  (full history, same pattern as credit_transactions)
-- ---------------------------------------------------------------------
create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_transactions_user on public.xp_transactions (user_id);

alter table public.xp_transactions enable row level security;

drop policy if exists "users view own xp history" on public.xp_transactions;
create policy "users view own xp history"
  on public.xp_transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------
-- grant_xp(): the ONLY thing that writes to profiles.xp. Deliberately
-- NOT exposed as a callable RPC (see the revoke below) — it only runs
-- when called from inside another SECURITY DEFINER function in this
-- file (handle_new_user, apply_to_bounty, admin_award_xp, etc.), which
-- Postgres executes using the function owner's privileges regardless
-- of what's been revoked from the `authenticated` role. If this were
-- left callable from the client, any signed-in user could give
-- themselves unlimited XP by calling it directly.
-- ---------------------------------------------------------------------
create or replace function public.grant_xp(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set xp = greatest(0, xp + p_amount) where id = p_user_id;
  insert into public.xp_transactions (user_id, amount, reason) values (p_user_id, p_amount, p_reason);
end;
$$;

revoke execute on function public.grant_xp(uuid, int, text) from public, anon, authenticated;

-- Admin-facing wrapper — this one IS callable by clients, but checks
-- is_admin() itself before doing anything.
create or replace function public.admin_award_xp(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can award XP';
  end if;
  perform public.grant_xp(p_user_id, p_amount, coalesce(nullif(p_reason, ''), 'admin_adjustment'));
  insert into public.notifications (user_id, type, title, message)
  values (p_user_id, 'xp_awarded', 'XP awarded', p_amount || ' XP added to your account.');
end;
$$;

-- ---------------------------------------------------------------------
-- BADGES  (catalog + award join table). Same non-callable-award
-- pattern as XP — award_badge() is internal-only.
-- ---------------------------------------------------------------------
create table if not exists public.badges (
  code text primary key,
  label text not null,
  emoji text not null,
  description text
);

insert into public.badges (code, label, emoji, description) values
  ('early_supporter', 'Early Supporter', '🌟', 'Joined Monad Africa in its early days.'),
  ('top_contributor', 'Top Contributor', '🏆', 'Among the most active referrers and builders.'),
  ('community_builder', 'Community Builder', '🛠', 'Actively grows the Monad Africa community.'),
  ('bounty_hunter', 'Bounty Hunter', '🎯', 'Had a bounty submission approved.'),
  ('ambassador', 'Ambassador', '🤝', 'Official Monad Africa ambassador.'),
  ('moderator', 'Moderator', '🛡', 'Helps moderate the Monad Africa community.'),
  ('verified_builder', 'Verified Builder', '💎', 'Verified as an active, trusted builder.'),
  ('monad_pioneer', 'Monad Pioneer', '🚀', 'Among the earliest builders on Monad.')
on conflict (code) do nothing;

alter table public.badges enable row level security;
drop policy if exists "badges catalog is public" on public.badges;
create policy "badges catalog is public" on public.badges for select using (true);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

alter table public.user_badges enable row level security;
drop policy if exists "user badges are public" on public.user_badges;
create policy "user badges are public" on public.user_badges for select using (true);
-- (public read so badges can display on any profile/leaderboard entry —
-- no sensitive data here, just which badges a user has earned)

create or replace function public.award_badge(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_badges (user_id, badge_code) values (p_user_id, p_code)
  on conflict do nothing;
  if found then
    insert into public.notifications (user_id, type, title, message)
    select p_user_id, 'badge_earned', 'Badge earned', label || ' — ' || description
    from public.badges where code = p_code;
  end if;
end;
$$;

revoke execute on function public.award_badge(uuid, text) from public, anon, authenticated;

create or replace function public.admin_award_badge(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can award badges';
  end if;
  perform public.award_badge(p_user_id, p_code);
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications: widen the type list to cover XP/badge/credit events.
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'new_bounty', 'submission_accepted', 'submission_rejected', 'credits_refreshed',
  'event_announced', 'referral', 'application_update', 'xp_awarded', 'badge_earned',
  'credits_awarded', 'announcement', 'won_bounty'
));

-- ---------------------------------------------------------------------
-- Re-create handle_new_user(): unchanged credit grant, PLUS grants the
-- referrer +10 XP alongside their existing +1 credit.
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
      perform public.grant_xp(referrer.id, 10, 'referral_bonus');
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit and 10 XP.');
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create apply_to_bounty(): unchanged credit deduction, PLUS +15 XP
-- for the applicant.
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

  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.full_name, v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
  returning * into v_application;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = credits - 1 where id = auth.uid();

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), -1, 'bounty_application:' || p_bounty_id::text);

  perform public.grant_xp(auth.uid(), 15, 'bounty_application:' || p_bounty_id::text);

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create admin_adjust_credits(): unchanged logic, PLUS a
-- notification (the brief calls this out explicitly for the
-- notification center — this was missing before).
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

  insert into public.notifications (user_id, type, title, message)
  values (
    p_user_id, 'credits_awarded',
    case when p_amount >= 0 then 'Credits added' else 'Credits removed' end,
    abs(p_amount) || ' credit(s) ' || (case when p_amount >= 0 then 'added to' else 'removed from' end) || ' your account.'
  );

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_approve_submission(): wraps the plain UPDATE the admin
-- dashboard used to do directly, adding XP + a first-win "Bounty
-- Hunter" badge + a dedicated "won bounty" notification.
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

  perform public.grant_xp(v_submission.user_id, 50, 'submission_approved:' || p_submission_id::text);

  if not v_already_won then
    perform public.award_badge(v_submission.user_id, 'bounty_hunter');
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (v_submission.user_id, 'won_bounty', 'Submission approved!', 'Your bounty submission was accepted — you earned 50 XP.');

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- Profile-completion bonus: called from the client after a profile
-- save. Only pays out once (profile_complete_bonus_awarded), and only
-- if the profile is genuinely fully filled in — recomputed server-side
-- rather than trusting a client-sent "you're done" flag.
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
  perform public.grant_xp(auth.uid(), 20, 'profile_complete_bonus');
  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Profile complete!', 'You earned 20 XP for completing your profile.');

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Safety net: if a signed-in user somehow has no profiles row (e.g. the
-- signup trigger failed, or an account predates it), create one with
-- the standard 3-credit grant on next login. Callable by the user
-- themselves — checks auth.uid() directly, no admin needed.
-- ---------------------------------------------------------------------
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.profiles (id, email, credits, referral_code)
  values (auth.uid(), v_email, 3, public.generate_referral_code())
  returning * into v_profile;

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), 3, 'signup_bonus_backfill');

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- Self-service account deletion (Settings page). Same limitation as
-- admin_delete_profile_data: removes profile data, does NOT delete the
-- login/auth account (needs the Supabase Admin API + service_role,
-- which cannot run client-side). Signs the user out client-side after.
-- ---------------------------------------------------------------------
create or replace function public.self_delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.submissions where user_id = auth.uid();
  delete from public.applications where user_id = auth.uid();
  delete from public.credit_transactions where user_id = auth.uid();
  delete from public.xp_transactions where user_id = auth.uid();
  delete from public.user_badges where user_id = auth.uid();
  delete from public.notifications where user_id = auth.uid();
  delete from public.admins where id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- BOUNTIES: featured flag (admin "Feature Bounties" capability)
-- ---------------------------------------------------------------------
alter table public.bounties add column if not exists is_featured boolean not null default false;

-- =====================================================================
-- Done.
-- =====================================================================
