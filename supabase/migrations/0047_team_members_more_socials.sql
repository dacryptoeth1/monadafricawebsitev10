-- =====================================================================
-- Monad Africa — 0047: More team member social links
--
-- Small, additive follow-up to 0035 — no new tables, no backfill (there
-- is nothing real to backfill with). team_members only had x_url and
-- telegram_url; the new team profile modal (src/components/
-- TeamMemberModal.tsx) is built to show LinkedIn/GitHub/Discord/Website
-- too, but only when a real value exists here — these columns start
-- null for every existing member and stay that way until an admin adds
-- a real one via Admin -> Team Management.
-- =====================================================================

alter table public.team_members
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists discord_url text,
  add column if not exists website_url text;
