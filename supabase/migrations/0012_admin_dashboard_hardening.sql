-- =====================================================================
-- Monad Africa — 0012: Admin Dashboard hardening
-- Run in Supabase SQL Editor AFTER 0001-0011.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
--
-- WHY THIS FILE EXISTS: a full audit of the existing Admin Dashboard
-- found a few real gaps, fixed here at the database layer (the real
-- trust boundary in this app, same as every prior round):
--   1. Submission rejection was a plain client-side UPDATE + a separate
--      notification insert — unlike approval, which is one atomic RPC.
--      Same inconsistency risk (a network drop between the two calls
--      leaves a rejected submission with no notification sent).
--   2. The Ambassador toggle did a direct `profiles` update plus a
--      separate badge-award RPC — same non-atomic pattern.
--   3. Credits/XP totals (Admin → Credits, and the new Analytics tab)
--      were computed by fetching every transaction row to the browser
--      and summing client-side — doesn't scale, and is unnecessary
--      network weight. Replaced with a server-side aggregate.
--   4. Leaderboard Management asked for a real action beyond "view top
--      25" — a per-user "hide from public leaderboard" flag, for
--      test/flagged accounts.
-- No existing function signature, RLS policy, or role check is
-- changed by this file.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_reject_submission(): mirrors admin_approve_submission() —
-- atomic status update + notification, is_admin() gated (Moderators
-- included, same tier as approval always was).
-- ---------------------------------------------------------------------
create or replace function public.admin_reject_submission(p_submission_id uuid, p_reason text default null)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reject submissions';
  end if;

  update public.submissions set status = 'rejected' where id = p_submission_id
  returning * into v_submission;

  if not found then
    raise exception 'Submission not found';
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (
    v_submission.user_id, 'submission_rejected', 'Submission rejected',
    coalesce(nullif(p_reason, ''), 'Your bounty submission was not accepted this time.')
  );

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_toggle_ambassador(): wraps the profile-update + badge-award
-- into one atomic call, is_admin() gated (unchanged tier from before —
-- this was already Admin+ only in the UI, now enforced here too).
-- ---------------------------------------------------------------------
create or replace function public.admin_toggle_ambassador(p_user_id uuid, p_is_ambassador boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change ambassador status';
  end if;

  update public.profiles set is_ambassador = p_is_ambassador where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  if p_is_ambassador then
    perform public.award_badge(p_user_id, 'ambassador');
  end if;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_credit_totals() / admin_xp_totals(): server-side sums so the
-- Credits tab and the new Analytics tab stop pulling every transaction
-- row to the browser just to add them up. is_admin() gated (read-only,
-- same visibility tier admins already had into this data).
-- ---------------------------------------------------------------------
create or replace function public.admin_credit_totals()
returns table (issued bigint, spent bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where amount > 0), 0)::bigint as issued,
    coalesce(abs(sum(amount) filter (where amount < 0)), 0)::bigint as spent
  from public.credit_transactions
  where public.is_admin();
$$;

create or replace function public.admin_xp_totals()
returns table (issued bigint, spent bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where amount > 0), 0)::bigint as issued,
    coalesce(abs(sum(amount) filter (where amount < 0)), 0)::bigint as spent
  from public.xp_transactions
  where public.is_admin();
$$;

-- ---------------------------------------------------------------------
-- admin_xp_by_reason(): powers the Analytics tab's "XP by source"
-- breakdown. Transaction reasons like 'submission_approved:<uuid>' are
-- bucketed by the part before the colon so the chart shows "submission
-- approved" once, not one bar per submission. Same non-throwing,
-- is_admin()-gated read pattern as the totals functions above.
-- ---------------------------------------------------------------------
create or replace function public.admin_xp_by_reason()
returns table (bucket text, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select split_part(reason, ':', 1) as bucket, sum(amount)::bigint as total
  from public.xp_transactions
  where public.is_admin()
  group by 1
  order by total desc;
$$;

-- ---------------------------------------------------------------------
-- Leaderboard Management: per-user opt-out of the public leaderboard
-- (test/flagged accounts). Defaults to visible (false) for everyone
-- existing, matching current behavior exactly.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists hide_from_leaderboard boolean not null default false;

-- ---------------------------------------------------------------------
-- Indexes to support the new pagination/sorting added across the admin
-- dashboard this round (Users sort-by-XP, Leaderboard, Overview
-- "online" count, Submissions/Applications status filters).
-- ---------------------------------------------------------------------
create index if not exists idx_profiles_xp on public.profiles (xp desc);
create index if not exists idx_profiles_last_seen on public.profiles (last_seen);
create index if not exists idx_submissions_status on public.submissions (status);
create index if not exists idx_applications_status on public.applications (status);

-- =====================================================================
-- Done.
-- =====================================================================
