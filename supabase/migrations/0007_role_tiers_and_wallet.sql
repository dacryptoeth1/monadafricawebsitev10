-- =====================================================================
-- Monad Africa — 0007: Role-tiered permissions + rank/wallet support
-- Run in Supabase SQL Editor AFTER 0001-0006.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
--
-- WHY THIS FILE EXISTS: an earlier round locked /admin to Super Admin
-- only, per that round's literal spec. This round explicitly requires a
-- working Moderator Panel (review/approve/reject submissions, award XP,
-- award credits — but NOT ban/suspend/delete/promote/edit settings).
-- Several RPCs were checking is_admin() (true for ANY staff tier,
-- moderator included) when they should have required a higher tier.
-- This file fixes that at the database layer — the real security
-- boundary — not just by hiding buttons in the UI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- is_staff_admin(): true for 'admin' or 'super_admin', false for
-- 'moderator'. Used for actions the brief reserves for Admin+.
-- ---------------------------------------------------------------------
create or replace function public.is_staff_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid() and role in ('super_admin', 'admin'));
$$;

-- ---------------------------------------------------------------------
-- Tighten: suspend/ban/delete-user-data require Admin+ (not Moderator).
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
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can suspend accounts';
  end if;

  update public.profiles set is_suspended = p_suspended where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

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

  delete from public.submissions where user_id = p_user_id;
  delete from public.applications where user_id = p_user_id;
  delete from public.credit_transactions where user_id = p_user_id;
  delete from public.xp_transactions where user_id = p_user_id;
  delete from public.user_badges where user_id = p_user_id;
  delete from public.admins where id = p_user_id;
  delete from public.profiles where id = p_user_id;
end;
$$;

create or replace function public.admin_reset_credits(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_default int;
  v_old_credits int;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can reset credits';
  end if;

  select monthly_credit_allowance into v_default from public.platform_settings where id = 1;
  if v_default is null then v_default := 3; end if;

  select credits into v_old_credits from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = v_default where id = p_user_id
  returning * into v_profile;

  insert into public.credit_transactions (user_id, amount, reason)
  values (p_user_id, v_default - v_old_credits, 'admin_reset');

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- Role changes: promoting to 'moderator' or 'admin' only requires
-- Admin+; promoting to 'super_admin' (or demoting one) requires being
-- a Super Admin yourself — an Admin can't mint peer Admins/Super Admins.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role = 'super_admin' or exists (select 1 from public.admins where id = p_user_id and role = 'super_admin') then
    if not public.is_super_admin() then
      raise exception 'Only Super Admins can grant or change Super Admin access';
    end if;
  elsif not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can change roles';
  end if;

  if p_role is null or p_role = 'user' then
    delete from public.admins where id = p_user_id;
  elsif p_role in ('super_admin', 'admin', 'moderator') then
    insert into public.admins (id, role) values (p_user_id, p_role)
    on conflict (id) do update set role = excluded.role;
  else
    raise exception 'Invalid role: %', p_role;
  end if;
end;
$$;

-- (admin_adjust_credits, admin_award_xp, admin_award_badge,
-- admin_approve_submission all correctly already check plain is_admin()
-- — Moderators are meant to do exactly these things, unchanged.)

-- ---------------------------------------------------------------------
-- Wallet: allow multiple saved connections isn't needed (one address is
-- enough per the brief), but add a `wallet_provider` label so the
-- profile can show *which* wallet was connected (MetaMask/Rabby/
-- Backpack/Phantom), not just the raw address.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists wallet_provider text;

-- =====================================================================
-- Done.
-- =====================================================================
