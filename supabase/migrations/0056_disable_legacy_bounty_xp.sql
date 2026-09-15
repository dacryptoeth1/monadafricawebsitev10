-- =====================================================================
-- Monad Africa — 0056: Disable legacy bounty-application/approval XP
-- Run in Supabase SQL Editor AFTER 0001-0055.
-- Self-contained (CREATE OR REPLACE throughout) — safe to re-run.
--
-- WHY THIS FILE EXISTS: after reviewing migration 0055, the product
-- decision came back explicit — the new 5-action XP system (daily
-- check-in, +10 bounty host, +10 bounty winner, +10 product submission,
-- 0 referral) REPLACES the old bounty-related XP rewards entirely, not
-- just adds to them. Two mechanisms from the pre-existing system still
-- granted XP that has no place in the new rules:
--
--   1. apply_to_bounty() granted a small recurring XP nibble
--      (xp_reward('first_submission') / 5) every time a user applied to
--      a bounty, PLUS a one-time 25 XP "first submission bonus" the
--      very first time they ever applied. Neither survives — applying
--      to a bounty (spending a credit to be considered) is not one of
--      the five qualifying actions.
--
--   2. admin_approve_submission() granted +50 XP the moment an admin
--      approved a submission — separate from, and in addition to,
--      admin_mark_submission_winner()'s winner-only bonus. Only the
--      winner bonus (now +10, see 0055) survives; mere approval no
--      longer grants XP on its own. (The +10 "product submission" XP
--      already happens earlier and separately, at the moment the
--      submission is first created — see the AFTER INSERT trigger
--      added in 0055 — so approval was always a SECOND, later XP grant
--      on top of that one; that second grant is what's removed here.)
--
-- Both functions are modified in place — not replaced with parallel
-- functions — so there is exactly one apply_to_bounty() and one
-- admin_approve_submission() in this schema, same as before. Every
-- other behavior of each function (credit deduction, application
-- record, submission approval, badge award, notifications minus the
-- XP amount they used to quote) is UNCHANGED.
--
-- NOTHING HISTORICAL IS TOUCHED: no row in xp_transactions is deleted
-- or modified, no profile's accumulated xp is recalculated or reduced.
-- A user who already received the old 25 XP first-submission bonus or
-- an old 50 XP approval grant keeps that XP and that ledger entry
-- exactly as it is — this migration only stops those same code paths
-- from creating any NEW entries going forward. xp_reward_config rows
-- for 'first_submission' and 'submission_approved' are zeroed and
-- relabeled (same treatment as 'referral' in 0055) purely so the Admin
-- → XP Config panel doesn't show a stale, unused-but-misleadingly-live
-- number next to them — no function reads either value anymore.
-- =====================================================================

set lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. XP reward config: mark both legacy keys inert, same pattern as
-- 'referral' in 0055. Purely cosmetic/administrative — see above, no
-- function reads these values after this file.
-- ---------------------------------------------------------------------
update public.xp_reward_config
set amount = 0, label = 'Submit First Bounty (disabled — replaced by product-submission XP)', updated_at = now()
where key = 'first_submission';

update public.xp_reward_config
set amount = 0, label = 'Approved Bounty Submission (disabled — replaced by product-submission XP)', updated_at = now()
where key = 'submission_approved';

-- ---------------------------------------------------------------------
-- 2. apply_to_bounty(): identical to the 0031 version except the two
-- grant_xp() calls (the per-application nibble and the one-time first-
-- submission bonus) and their accompanying notification are removed.
-- Credit deduction, the application insert, the "already applied"/
-- credits/bounty-open checks, and the return shape are all unchanged.
-- first_submission_bonus_awarded is left alone as a column (still
-- readable/historical) but is no longer written here since nothing
-- reads it for a still-active bonus anymore.
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
  if not found or v_bounty.status <> 'approved' or v_bounty.is_closed or v_bounty.is_deleted then
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

  -- No XP for applying anymore — see file header. Only the +10
  -- "product submission" XP (granted when the actual work is
  -- submitted, migration 0055) and the +10 "bounty winner" XP survive
  -- from the old bounty-application/approval pipeline.

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. admin_approve_submission(): identical to the 0010 version except
-- the grant_xp() call is removed and the notification no longer quotes
-- an XP amount that no longer happens. Status update, the "already won
-- this bounty before" check, the bounty_hunter badge award, and the
-- return shape are all unchanged — approval still means something,
-- it just no longer mints XP on its own (the submission already
-- earned its +10 at creation time; winning earns a further +10).
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

  if not v_already_won then
    perform public.award_badge(v_submission.user_id, 'bounty_hunter');
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (v_submission.user_id, 'won_bounty', 'Submission approved!', 'Your bounty submission was accepted.');

  return v_submission;
end;
$$;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table dropped, no column removed, no xp_transactions or
-- profiles.xp row touched — only the two functions above (still the
-- same functions, not replacements) and the two xp_reward_config rows'
-- amount/label were changed, exactly as this file's header describes.
-- =====================================================================
