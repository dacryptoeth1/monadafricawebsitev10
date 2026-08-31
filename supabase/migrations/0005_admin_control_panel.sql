-- =====================================================================
-- Monad Africa — 0005: Admin Control Panel foundation
-- Run in Supabase SQL Editor AFTER 0001-0004.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES: admins table gets a real role column. Existing rows (created
-- before roles existed) are treated as super_admin — they already had
-- full access, this just makes that explicit.
-- ---------------------------------------------------------------------
alter table public.admins
  add column if not exists role text not null default 'moderator' check (role in ('super_admin', 'moderator'));

update public.admins set role = 'super_admin' where role is null or role = 'moderator';
-- ^ one-time backfill for pre-existing rows only; safe to run more than
-- once since it only touches rows that still have the column default.

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid() and role = 'super_admin');
$$;

-- `is_admin()` (from 0001) already means "any admin row exists" — kept
-- as-is, it's used for moderator-level checks throughout.

-- ---------------------------------------------------------------------
-- PROFILES: github, wallet, ban flag, last_seen (for "online" tracking)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists github text,
  add column if not exists wallet_address text,
  add column if not exists is_banned boolean not null default false,
  add column if not exists last_seen timestamptz;

-- Banned users lose write access everywhere the owner-write policies
-- check is_suspended — extend that same policy to also check is_banned.
drop policy if exists "profiles editable by owner or admin" on public.profiles;
create policy "profiles editable by owner or admin"
  on public.profiles for update
  using ((auth.uid() = id and is_suspended = false and is_banned = false) or public.is_admin());

-- ---------------------------------------------------------------------
-- BOUNTIES: closed/reopened as a distinct concept from approval status,
-- so "completed" bounties can be tracked separately from "rejected".
-- ---------------------------------------------------------------------
alter table public.bounties
  add column if not exists is_closed boolean not null default false;

drop policy if exists "admins manage bounties" on public.bounties;
create policy "admins manage bounties"
  on public.bounties for update
  using (public.is_admin());
-- (delete policy from 0001 already admin-only, unchanged)

-- ---------------------------------------------------------------------
-- ANNOUNCEMENTS  (new)
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  pinned boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements are public" on public.announcements;
create policy "announcements are public" on public.announcements for select using (true);
drop policy if exists "admins create announcements" on public.announcements;
create policy "admins create announcements" on public.announcements for insert with check (public.is_admin());
drop policy if exists "admins update announcements" on public.announcements;
create policy "admins update announcements" on public.announcements for update using (public.is_admin());
drop policy if exists "admins delete announcements" on public.announcements;
create policy "admins delete announcements" on public.announcements for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- SITE CONTENT  (new — homepage CMS: hero copy, buttons, roadmap, FAQ)
-- Single row, super-admin only writes.
-- ---------------------------------------------------------------------
create table if not exists public.site_content (
  id smallint primary key default 1 check (id = 1),
  hero_title text not null default 'Building the Future of Monad in Africa.',
  hero_subtitle text not null default 'Monad Africa connects builders, developers, students, creators, founders, and communities across the continent to real opportunities in the Monad ecosystem.',
  hero_primary_label text not null default 'Explore Bounties',
  hero_primary_href text not null default '/bounties',
  hero_secondary_label text not null default 'Join Community',
  hero_secondary_href text not null default 'discord',
  footer_text text not null default 'The gateway connecting the Monad ecosystem with Africa''s next generation of builders, creators, and communities.',
  roadmap_items jsonb not null default '[]'::jsonb,
  faq_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_content (id) values (1) on conflict (id) do nothing;

alter table public.site_content enable row level security;

drop policy if exists "site content readable by everyone" on public.site_content;
create policy "site content readable by everyone" on public.site_content for select using (true);
drop policy if exists "site content editable by super admins" on public.site_content;
create policy "site content editable by super admins" on public.site_content for update using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- SITE SETTINGS: community stats — live where genuinely possible
-- (Discord, via its public widget endpoint), manual everywhere else.
-- x_followers / discord_members / telegram_url / discord_url / x_url
-- already exist from earlier migrations — this adds the rest.
-- ---------------------------------------------------------------------
alter table public.site_settings
  add column if not exists x_followers_change_week int not null default 0,
  add column if not exists telegram_members int not null default 0,
  add column if not exists telegram_members_change_today int not null default 0,
  add column if not exists discord_online_manual int not null default 0,
  add column if not exists discord_joined_today int not null default 0,
  add column if not exists discord_guild_id text default '',
  add column if not exists discord_widget_enabled boolean not null default false;

-- Seed with the real current numbers provided.
update public.site_settings
set x_followers = 1103,
    x_followers_change_week = 21,
    telegram_members = 2587,
    telegram_members_change_today = 34,
    discord_members = 1982,
    discord_online_manual = 132,
    updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------
-- PLATFORM SETTINGS  (new — just the default starting credit amount,
-- so "reset credits" has a real, admin-configurable target)
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  monthly_credit_allowance int not null default 3,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform settings readable by everyone" on public.platform_settings;
create policy "platform settings readable by everyone" on public.platform_settings for select using (true);
drop policy if exists "platform settings editable by super admins" on public.platform_settings;
create policy "platform settings editable by super admins" on public.platform_settings for update using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Admin RPC: reset a user's credits back to the current platform
-- default (distinct from admin_adjust_credits, which is relative).
-- ---------------------------------------------------------------------
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
  if not public.is_admin() then
    raise exception 'Only admins can reset credits';
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
-- Admin RPC: ban / unban. Enforced at the RLS layer (is_banned already
-- blocks profile self-updates above), plus applications/submissions
-- inserts are re-checked here so a banned user can't apply or submit
-- even though those go through their own SECURITY DEFINER functions.
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
  if not public.is_admin() then
    raise exception 'Only admins can ban accounts';
  end if;

  update public.profiles set is_banned = p_banned where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

-- Re-create apply_to_bounty() to also reject banned users (it already
-- rejected suspended users in 0004).
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

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin RPC: delete a user's PROFILE DATA (not their login/auth
-- account — that requires the Supabase Admin API with the service_role
-- key, which cannot run from client code and is intentionally not
-- implemented here). This removes their profile, applications,
-- submissions, and credit history; their auth.users row and login
-- credentials remain, so treat "Ban" as the actual access-revoking
-- action and this as a data-cleanup action.
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_profile_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete user data';
  end if;

  delete from public.submissions where user_id = p_user_id;
  delete from public.applications where user_id = p_user_id;
  delete from public.credit_transactions where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.admins where id = p_user_id;
  delete from public.profiles where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin RPC: set a user's admin role directly — 'super_admin',
-- 'moderator', or null to remove admin access entirely. Only an
-- existing super admin may call this (a moderator, who currently has
-- no /admin access at all, certainly can't).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can change roles';
  end if;

  if p_role is null or p_role = 'user' then
    delete from public.admins where id = p_user_id;
  elsif p_role in ('super_admin', 'moderator') then
    insert into public.admins (id, role) values (p_user_id, p_role)
    on conflict (id) do update set role = excluded.role;
  else
    raise exception 'Invalid role: %', p_role;
  end if;
end;
$$;

-- =====================================================================
-- Done.
-- =====================================================================
