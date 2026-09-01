-- =====================================================================
-- Monad Africa — 0036: Restore anon/authenticated write grants
-- Run in Supabase SQL Editor AFTER 0035.
--
-- WHY THIS FILE EXISTS: live testing after 0035 was applied found that
-- the new "anyone can submit a partnership enquiry" INSERT on
-- partnership_submissions was rejected with
--   "new row violates row-level security policy for table
--   partnership_submissions"
-- for every possible payload, including ones that trivially satisfy the
-- policy's WITH CHECK clause. Comparing against known-longstanding
-- anon-write paths on this exact project showed the SAME failure on
-- public.bounties (the "Host a Bounty" form, HostBounty.tsx) and
-- public.applications (the "Apply to a bounty" flow) — tables whose
-- `with check (true)` / `with check (status = 'pending')` policies are
-- unchanged since migration 0001 and clearly not the problem.
--
-- That rules out a bug in any RLS policy text (new or old) and points
-- at the other prerequisite RLS depends on: the base table-level GRANT.
-- Follow-up checks confirmed the breakage is scoped precisely to
-- write privileges: SELECT (team_members, and every existing public
-- read) and RPC EXECUTE (total_registered_users() via anon) both work
-- correctly right now — only INSERT (tested on bounties, applications,
-- and partnership_submissions) fails. So this grants exactly the
-- missing piece — INSERT/UPDATE/DELETE table privileges — and nothing
-- already known to be working, keeping this the smallest fix that
-- matches the evidence.
--
-- Migration 0026 in this same repo already documented and fixed this
-- exact class of drift for `events` SELECT — this is the same
-- phenomenon, for write privileges, schema-wide (every table tested,
-- old and new, showed it) rather than one table. This restores
-- Supabase's own standard baseline (coarse table-level grants; RLS
-- policies remain the real, fine-grained gate — every table here
-- already has `enable row level security` with its own restrictive
-- policies, so this does not loosen what's actually reachable, it only
-- lets Postgres reach the RLS check at all) and re-asserts it as the
-- default for any table created from now on, so this can't silently
-- recur on the next new table.
--
-- Purely additive: no RLS policy, table, or row is touched by this file.
-- =====================================================================

grant insert, update, delete on all tables in schema public to anon, authenticated;

-- So the next `create table` in a future migration gets this
-- automatically, instead of silently needing this same fix again.
alter default privileges in schema public grant insert, update, delete on tables to anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. RLS policies (unchanged by this file) remain the real
-- access-control layer — this only restores the base privilege RLS
-- needs to be evaluated in the first place.
-- =====================================================================
