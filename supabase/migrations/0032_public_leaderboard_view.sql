-- =====================================================================
-- Monad Africa — 0032: Public leaderboard/stats visibility
-- Run in Supabase SQL Editor AFTER 0001-0031.
--
-- WHY THIS FILE EXISTS: `public.profiles` has only ever had one SELECT
-- policy, unchanged since 0001_init.sql and re-asserted identically in
-- every later migration that touched profiles (0002, 0014, 0018):
--
--   using (auth.uid() = id or public.is_admin())
--
-- That means a user can only ever SELECT their OWN row, or (if an
-- admin) every row. There has never been a way for anyone — logged out
-- OR logged in as an ordinary user — to read another user's profile
-- row directly. Confirmed live against production with the anon key
-- before writing this file: the leaderboard query, the homepage's
-- "Registered Users" count, and the homepage's "Featured Contributors"
-- query all return zero rows for a real (non-admin) visitor today.
-- This is not a new regression — it's how the policy has always
-- behaved; the app-level UI just never surfaced it as an obvious error
-- because every affected query treats "0 rows" as a valid empty state.
--
-- Fix: rather than relaxing the profiles table's own RLS (which would
-- risk exposing email/wallet_address/etc. to any query against the
-- table), expose only the minimum public-safe columns through a VIEW.
-- Views in Postgres check table privileges as the VIEW OWNER, not the
-- querying role — and table owners are exempt from their own table's
-- RLS by default (profiles was never put under FORCE ROW LEVEL
-- SECURITY) — so a view created here (owned by the same role that owns
-- `profiles`) can safely see every row while only ever returning the
-- columns explicitly listed below. `profiles` itself, its RLS policy,
-- and every other column are completely untouched.
-- =====================================================================

set lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. Public leaderboard/profile-preview view — id, display fields, and
-- the two public "stats" (xp, total_referrals) only. No email, wallet
-- address, bio, socials, suspension/ban flags, or any other private
-- field. Same hide_from_leaderboard filter the app already applies —
-- this view doesn't change who opts out, only who can read the result.
-- ---------------------------------------------------------------------
create or replace view public.leaderboard_public as
select
  id,
  username,
  full_name,
  avatar_url,
  country,
  xp,
  total_referrals
from public.profiles
where hide_from_leaderboard = false;

grant select on public.leaderboard_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Total registered user count — used by the homepage "Registered
-- Users" stat. A bare integer, not a view, since this one legitimately
-- needs every profile (including hide_from_leaderboard ones) and
-- carries zero PII either way.
-- ---------------------------------------------------------------------
create or replace function public.total_registered_users()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.profiles;
$$;

revoke all on function public.total_registered_users() from public;
grant execute on function public.total_registered_users() to anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. `public.profiles`, its RLS policy, and every column not listed
-- above are untouched. No table dropped, no row touched, no existing
-- admin/owner access changed.
-- =====================================================================
