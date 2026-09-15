-- =====================================================================
-- Monad Africa — 0055: XP system v2 (referral XP removed, bounty
-- host/winner + product submission XP added), required social links at
-- signup, and profile-field write hardening.
-- Run in Supabase SQL Editor AFTER 0001-0054.
-- Self-contained (IF NOT EXISTS / OR REPLACE / guarded blocks
-- throughout) — safe to re-run.
--
-- WHAT THIS FILE DOES (see the accompanying app-side changes for the
-- full picture):
--
--   1. Referral XP removed. Referrals still exist (referral_code,
--      referred_by, total_referrals, the +1 credit) — only the XP that
--      used to come with them is gone. xp_reward_config.referral is
--      forced to 0 and handle_new_user() no longer calls grant_xp for
--      it at all, so re-enabling it isn't just a config-panel toggle.
--
--   2. profiles.twitter / profiles.discord (both already existed —
--      see 0018) are now populated straight from signup metadata, not
--      only from a later Edit Profile save. Required-ness for NEW
--      signups is enforced in the signup form (see Signup.tsx) — this
--      migration does NOT add a NOT NULL constraint, because that would
--      break every existing account that predates this field.
--
--   3. Two new XP-reward-config keys: bounty_host (10) and
--      product_submission (10). bounty_winner is corrected from its
--      prior 100 to the newly-specified 10 — a deliberate one-time
--      value correction, not an additive seed. profile_complete,
--      wallet_connect, first_submission, submission_approved, and
--      community_campaign are UNTOUCHED — they're existing bonuses
--      this round's spec never mentions, so nothing about them is
--      removed or changed (see the accompanying summary for why).
--
--   4. bounty_host XP is granted exactly once per hosting request, at
--      the one point a hosting request can ever become a live public
--      bounty (publish_bounty_hosting_request — already one-shot,
--      guarded by published_bounty_id).
--
--   5. product_submission XP is granted by a new AFTER INSERT trigger
--      on public.submissions — fires exactly once per row, so it's
--      inherently one-shot per submission. A submissions INSERT policy
--      change plus a best-effort unique index stop a second submission
--      row for the same application from ever being created in the
--      first place (defense in depth, independent of the trigger).
--
--   6. protect_profile_fields() (0003, last touched 0017) is extended
--      to also guard xp, checkin_streak, last_checkin_date,
--      wallet_bonus_awarded, profile_complete_bonus_awarded,
--      first_submission_bonus_awarded, is_suspended, is_banned,
--      is_ambassador, and hide_from_leaderboard — previously only
--      credits/referral_code/referred_by/total_referrals were guarded,
--      which meant a signed-in user could UPDATE their own xp (or
--      un-suspend/un-ban/ambassador-flag themselves) directly via the
--      Supabase client, bypassing every RPC this schema relies on for
--      those actions entirely. grant_xp() and daily_checkin() are
--      updated in the same file to set the existing bypass flag before
--      touching the newly-guarded columns they're each solely
--      responsible for, so this closes the hole without breaking any
--      legitimate award path.
--
--   7. leaderboard_public gains checkin_streak, so the public
--      leaderboard can show a streak column without ever exposing
--      last_checkin_date or any other private field.
--
-- Nothing here drops, renames, or narrows access to any existing table,
-- column, policy, or row beyond the intentional guard-list additions in
-- #6 above (which only ever affect a non-admin user's own row, and only
-- for fields that were never meant to be self-editable to begin with).
-- =====================================================================

set lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. XP reward config: new keys + the bounty_winner/referral corrections.
-- ---------------------------------------------------------------------
insert into public.xp_reward_config (key, label, amount) values
  ('bounty_host', 'Host a Bounty (published)', 10),
  ('product_submission', 'Submit Product/Work for a Bounty', 10)
on conflict (key) do nothing;

-- Deliberate one-time correction per this round's spec (was 100).
update public.xp_reward_config
set amount = 10, updated_at = now()
where key = 'bounty_winner' and amount <> 10;

-- Referral XP is removed outright — forced to 0 regardless of whatever
-- an admin previously set it to via Admin → XP Config. The label is
-- updated so that panel makes it obvious this one is intentionally
-- inert rather than just quietly zero. handle_new_user() below also
-- stops calling grant_xp() for this at all, so changing this number
-- back up in the admin panel would have no effect either way.
update public.xp_reward_config
set amount = 0, label = 'Successful Referral (disabled — no longer awarded)', updated_at = now()
where key = 'referral';

-- ---------------------------------------------------------------------
-- 2. grant_xp(): set the profile-protection bypass flag before its own
-- write to profiles.xp. Required because of #6 below — once xp is a
-- guarded column, this is the ONE place that's allowed to move it, for
-- every caller (daily_checkin, admin_award_xp, apply_to_bounty, the new
-- bounty-host/product-submission grants, ...) without having to touch
-- every call site individually. Behavior/signature otherwise unchanged.
-- ---------------------------------------------------------------------
create or replace function public.grant_xp(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set xp = greatest(0, xp + p_amount) where id = p_user_id;
  insert into public.xp_transactions (user_id, amount, reason) values (p_user_id, p_amount, p_reason);
end;
$$;

revoke execute on function public.grant_xp(uuid, int, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. daily_checkin(): same bypass-flag addition as grant_xp() above,
-- for the checkin_streak/last_checkin_date columns this function is
-- solely responsible for. Everything else (the row lock from 0053, the
-- calendar-day logic, the return shape) is unchanged.
-- ---------------------------------------------------------------------
create or replace function public.daily_checkin()
returns table (
  success boolean,
  already_checked_in boolean,
  xp int,
  checkin_streak int,
  checkin_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_new_streak int;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.last_checkin_date = v_today then
    return query select false, true, v_profile.xp, v_profile.checkin_streak, v_today;
    return;
  end if;

  v_new_streak := case when v_profile.last_checkin_date = v_today - 1 then v_profile.checkin_streak + 1 else 1 end;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles
  set last_checkin_date = v_today, checkin_streak = v_new_streak
  where id = auth.uid();

  perform public.grant_xp(auth.uid(), public.xp_reward('daily_checkin'), 'daily_checkin:' || v_today::text);

  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Daily check-in complete', '+' || public.xp_reward('daily_checkin') || ' XP — come back tomorrow to keep your streak going.');

  select * into v_profile from public.profiles where id = auth.uid();

  return query select true, false, v_profile.xp, v_profile.checkin_streak, v_today;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. protect_profile_fields(): extend the guarded column list. Every
-- column added here already has a legitimate, already-bypass-flagged
-- (or already is_admin()-gated) write path elsewhere in this schema —
-- see the file header for the full reasoning per column.
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
    new.xp := old.xp;
    new.checkin_streak := old.checkin_streak;
    new.last_checkin_date := old.last_checkin_date;
    new.wallet_bonus_awarded := old.wallet_bonus_awarded;
    new.profile_complete_bonus_awarded := old.profile_complete_bonus_awarded;
    new.first_submission_bonus_awarded := old.first_submission_bonus_awarded;
    new.is_suspended := old.is_suspended;
    new.is_banned := old.is_banned;
    new.is_ambassador := old.is_ambassador;
    new.hide_from_leaderboard := old.hide_from_leaderboard;
  end if;
  return new;
end;
$$;

-- Trigger already exists (0003) and already points at this function
-- name — CREATE OR REPLACE above is sufficient, no trigger re-creation
-- needed.

-- ---------------------------------------------------------------------
-- 5. handle_new_user(): insert twitter/discord from signup metadata,
-- and stop granting referral XP. Credit bonus + notification for the
-- referrer are unchanged apart from the message no longer mentioning
-- XP that no longer happens.
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
  insert into public.profiles (id, full_name, username, email, country, role, credits, referral_code, twitter, discord)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    3,
    public.generate_referral_code(),
    nullif(new.raw_user_meta_data->>'twitter', ''),
    nullif(new.raw_user_meta_data->>'discord', '')
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
      -- No XP for referrals anymore — see file header, section 1.
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit.');
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. publish_bounty_hosting_request(): grant the "Bounty Host" XP to
-- the request's creator, exactly once — this function already can only
-- ever run once per request (guarded by published_bounty_id/status
-- checks below, unchanged from 0037), which is what makes this
-- inherently one-shot. No other column, check, or behavior changed.
-- ---------------------------------------------------------------------
create or replace function public.publish_bounty_hosting_request(p_request_id uuid)
returns public.bounties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.bounty_hosting_requests%rowtype;
  v_bounty public.bounties%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish a bounty';
  end if;

  select * into v_req from public.bounty_hosting_requests where id = p_request_id;
  if not found then
    raise exception 'Bounty hosting request not found';
  end if;
  if v_req.status <> 'approved' then
    raise exception 'Only an approved hosting request can be published';
  end if;
  if v_req.published_bounty_id is not null then
    raise exception 'This request has already been published';
  end if;

  insert into public.bounties (
    project_name, logo_url, website, twitter, contact_email,
    title, description, skills_needed, category, difficulty, reward, deadline,
    status, hosting_request_id, verification_badge, assigned_admin, published_at
  ) values (
    v_req.project_name, v_req.logo_url, v_req.website, v_req.x_username, v_req.contact_email,
    v_req.title, v_req.description, v_req.required_skills, coalesce(v_req.category, 'Development'), 'medium',
    coalesce(v_req.total_reward, ''), coalesce(v_req.submission_deadline, current_date + interval '30 days'),
    'approved', v_req.id, 'verified', v_req.assigned_admin, now()
  )
  returning * into v_bounty;

  update public.bounty_hosting_requests
  set published_bounty_id = v_bounty.id
  where id = p_request_id;

  perform public.grant_xp(v_req.created_by, public.xp_reward('bounty_host'), 'bounty_host:' || v_bounty.id::text);
  insert into public.notifications (user_id, type, title, message)
  values (v_req.created_by, 'xp_awarded', 'Bounty published!', 'Your bounty "' || coalesce(v_bounty.title, 'Untitled') || '" is now live — you earned ' || public.xp_reward('bounty_host') || ' XP for hosting it.');

  return v_bounty;
end;
$$;

revoke all on function public.publish_bounty_hosting_request(uuid) from public;
grant execute on function public.publish_bounty_hosting_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. submissions: prevent more than one submission row per application
-- (defense in depth — the app UI already hides the Submit button once a
-- submission exists, this is the server-side backstop), then grant
-- "Product Submission" XP exactly once per row via an AFTER INSERT
-- trigger. An AFTER INSERT trigger fires exactly once per successfully
-- committed row, so this is inherently one-shot per submission — a
-- refresh can't re-fire it (nothing re-inserts), and an edit can't
-- either (submissions has no applicant-facing UPDATE policy at all;
-- only the project-owner/admin update paths exist, both UPDATEs, never
-- INSERTs).
-- ---------------------------------------------------------------------
drop policy if exists "signed-in users submit as themselves" on public.submissions;
create policy "signed-in users submit as themselves"
  on public.submissions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.bounties b
      where b.id = bounty_id
        and b.status = 'approved'
        and b.is_closed = false
        and b.is_deleted = false
    )
    and (
      application_id is null
      or not exists (select 1 from public.submissions s2 where s2.application_id = submissions.application_id)
    )
  );

-- Best-effort DB-level uniqueness on top of the policy check above —
-- skipped gracefully (with a notice, not a failed migration) if this
-- database already has pre-existing duplicate submissions per
-- application from before this constraint existed; the policy check
-- and the one-shot trigger below still fully protect XP either way.
do $$
begin
  create unique index if not exists ux_submissions_one_per_application
    on public.submissions (application_id)
    where application_id is not null;
exception
  when unique_violation then
    raise notice 'Skipping ux_submissions_one_per_application — this database already has more than one submission row for the same application_id. Product-submission XP is still safe (one AFTER INSERT trigger fire per row, plus the INSERT policy above blocking new duplicates) — clean up the existing duplicate rows and re-run this DO block if you also want the hard DB constraint.';
end $$;

create or replace function public.grant_product_submission_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_xp(new.user_id, public.xp_reward('product_submission'), 'product_submission:' || new.id::text);
  insert into public.notifications (user_id, type, title, message)
  values (new.user_id, 'xp_awarded', 'Work submitted!', 'Your submission was received — you earned ' || public.xp_reward('product_submission') || ' XP.');
  return new;
end;
$$;

drop trigger if exists trg_submissions_product_xp on public.submissions;
create trigger trg_submissions_product_xp
  after insert on public.submissions
  for each row execute function public.grant_product_submission_xp();

-- ---------------------------------------------------------------------
-- 8. leaderboard_public: add checkin_streak so the public leaderboard
-- can show a streak column. Every existing column stays exactly where
-- it is in the list (CREATE OR REPLACE VIEW only permits appending).
-- ---------------------------------------------------------------------
create or replace view public.leaderboard_public as
select
  id,
  username,
  full_name,
  avatar_url,
  country,
  xp,
  total_referrals,
  role,
  bio,
  twitter,
  website,
  project_or_company,
  checkin_streak
from public.profiles
where hide_from_leaderboard = false;

grant select on public.leaderboard_public to anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table dropped, no existing column removed, no existing row
-- touched (other than the two xp_reward_config amount/label
-- corrections above, which are exactly the point of this migration).
-- Existing users keep their XP, credits, referral relationships,
-- bounty/submission history, and the ability to log in — nothing here
-- alters auth.users or requires re-verifying any existing account.
-- =====================================================================
