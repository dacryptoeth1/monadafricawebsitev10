-- =====================================================================
-- Monad Africa — 0014: profiles schema cache fix + wallet field cleanup
-- Run in Supabase SQL Editor.
--
-- WHY THIS FILE EXISTS: saving the profile page failed with
-- "Could not find the 'full_name' column of 'profiles' in the schema
-- cache." Same root cause as 0013's site_settings recovery — `full_name`
-- has been in `0001_init.sql`'s `create table public.profiles` since the
-- very first migration, and every other column the Profile page writes
-- (wallet_address, username, region, bio, socials, xp/credit flags,
-- etc.) is added across 0002/0004/0005/0006/0007/0010/0012 — but on
-- this project's live database those files apparently weren't (all)
-- run, so PostgREST's cached schema doesn't know about the columns the
-- app is trying to write.
--
-- This file is a self-contained, idempotent patch that:
--   1. Creates `public.profiles` if it's somehow missing entirely.
--   2. Adds every column the Profile page (src/pages/Profile.tsx) and
--      the `Profile` type (src/types.ts) expect, if not already there —
--      safe to run even if some/all of them already exist.
--   3. Re-asserts RLS + the owner/admin policies so a freshly-created
--      table is immediately writable by its owner.
--   4. Forces PostgREST to reload its schema cache, so the fix takes
--      effect immediately without waiting on Supabase's auto-detection.
--
-- Safe to run multiple times, and safe to run whether or not 0001-0013
-- were previously applied.
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
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
  add column if not exists credits int not null default 3,
  add column if not exists xp int not null default 0,
  add column if not exists is_ambassador boolean not null default false,
  add column if not exists profile_complete_bonus_awarded boolean not null default false,
  add column if not exists wallet_bonus_awarded boolean not null default false,
  add column if not exists first_submission_bonus_awarded boolean not null default false,
  add column if not exists notifications_enabled boolean not null default true,
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles (id),
  add column if not exists total_referrals int not null default 0,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists hide_from_leaderboard boolean not null default false,
  add column if not exists last_seen timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_profiles_username on public.profiles (username);
create index if not exists idx_profiles_referral_code on public.profiles (referral_code);

-- ---------------------------------------------------------------------
-- RLS: re-assert (no-op if already correct) so a freshly-created table
-- is immediately usable — owner can read/insert/update their own row,
-- suspended/banned owners lose write access, admins can do both always.
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
-- Force PostgREST to drop its cached schema and re-read the database
-- now, instead of waiting for Supabase's own change-detection to kick
-- in. This is the direct fix for the "...in the schema cache" error.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =====================================================================
-- Done. If you still see a "schema cache" error immediately after
-- running this, go to Supabase Dashboard → Settings → API → click
-- "Reload schema cache", then retry the save.
-- =====================================================================
