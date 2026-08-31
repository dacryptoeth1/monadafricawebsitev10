-- =====================================================================
-- Monad Africa — 0031: Bounty lifecycle (soft-delete) + hardened
-- close/delete protection for the Admin "Manage Bounties" panel.
-- Run in Supabase SQL Editor AFTER 0001-0030.
--
-- WHY THIS FILE EXISTS: the admin dashboard's bounty "Delete" action was
-- a hard, cascading DELETE (see AdminDashboard.tsx removeBounty) — every
-- submission and application for that bounty was permanently destroyed
-- along with it. The new Admin "Manage Bounties" panel replaces that
-- with a soft delete, so submission/application history always survives
-- a bounty being taken down. `public.bounties` already has a `status`
-- column ('pending' | 'approved' | 'rejected' — the host-a-bounty
-- moderation workflow) and an `is_closed` boolean (open/closed toggle
-- for an approved bounty) from earlier migrations; this does not
-- replace either, it adds what's missing on top of them:
--
--   Draft   = status = 'pending' (or 'rejected')  — never public, same
--             as today; "rejected" is kept as a distinct sub-state so
--             the existing approve/reject moderation flow is unchanged.
--   Active  = status = 'approved' and is_closed = false and not deleted
--   Closed  = status = 'approved' and is_closed = true  and not deleted
--   Deleted = is_deleted = true (independent of the above — a deleted
--             bounty stays hidden regardless of its prior status)
--
-- This file only adds columns/checks — it does not touch the
-- pending/approved/rejected workflow, existing bounties/submissions
-- rows, or any table shape beyond additive columns.
-- =====================================================================

set lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. New columns: soft-delete flag + audit trail for close/delete.
-- ---------------------------------------------------------------------
alter table public.bounties
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles (id) on delete set null,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles (id) on delete set null;

create index if not exists bounties_is_deleted_idx on public.bounties (is_deleted);

-- ---------------------------------------------------------------------
-- 2. Auto-stamp closed_at/closed_by and deleted_at/deleted_by whenever
-- is_closed / is_deleted actually flips, instead of trusting the client
-- to send correct timestamps/actor. Reopening (is_closed -> false)
-- clears closed_at/closed_by the same way; restoring from the deleted
-- state clears deleted_at/deleted_by.
-- ---------------------------------------------------------------------
create or replace function public.bounties_set_lifecycle_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_closed and not old.is_closed then
    new.closed_at := now();
    new.closed_by := auth.uid();
  elsif not new.is_closed and old.is_closed then
    new.closed_at := null;
    new.closed_by := null;
  end if;

  if new.is_deleted and not old.is_deleted then
    new.deleted_at := now();
    new.deleted_by := auth.uid();
  elsif not new.is_deleted and old.is_deleted then
    new.deleted_at := null;
    new.deleted_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists bounties_lifecycle_audit on public.bounties;
create trigger bounties_lifecycle_audit
  before update on public.bounties
  for each row
  execute function public.bounties_set_lifecycle_audit();

-- ---------------------------------------------------------------------
-- 3. Public/user-facing SELECT: approved AND not deleted only. Admins
-- still see everything (draft/rejected/closed/deleted) via is_admin().
-- ---------------------------------------------------------------------
alter table public.bounties enable row level security;

drop policy if exists "approved bounties are public" on public.bounties;
create policy "approved bounties are public"
  on public.bounties for select
  using ((status = 'approved' and is_deleted = false) or public.is_admin());

-- Admin UPDATE policy already exists ("admins manage bounties", 0028) —
-- re-asserted here unchanged so a fresh/self-healing install stays
-- consistent; this is what lets admins close/reopen/soft-delete/edit.
drop policy if exists "admins manage bounties" on public.bounties;
create policy "admins manage bounties"
  on public.bounties for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. apply_to_bounty(): add the is_deleted check alongside the existing
-- status/is_closed checks (same rejection message — from the caller's
-- point of view a deleted bounty is just as "not open" as a closed or
-- still-pending one). Credits are only ever deducted after this check
-- passes, and the whole function runs as one atomic statement, so a
-- user can't be charged a credit for a bounty that turns out to be
-- unavailable, and two concurrent applications can't race past it.
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
  if not found or v_bounty.status <> 'approved' or v_bounty.is_closed or v_bounty.is_deleted then
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
-- 5. submissions INSERT: extend the closed-bounty check (0029/0030) to
-- also cover deleted and not-yet-approved bounties — this is the
-- database-level backstop the task calls for, independent of whatever
-- the SubmissionModal.tsx UI does or doesn't disable. A user calling
-- the Supabase API directly, bypassing the frontend entirely, still
-- cannot insert a submissions row against a bounty that isn't actively
-- open.
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
  );

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table dropped, no existing column altered/removed, no
-- submission/application row touched. Existing approve/reject/close/
-- reopen/feature flows are unaffected — this only adds the soft-delete
-- state, its audit columns, and closes the remaining gap where a
-- deleted or still-pending bounty could still accept a direct-API
-- submission.
-- =====================================================================
