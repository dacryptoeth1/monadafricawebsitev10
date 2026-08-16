-- =====================================================================
-- Monad Africa — 0028: Restore missing bounties/submissions columns
-- Run in Supabase SQL Editor AFTER 0001-0027.
--
-- WHY THIS FILE EXISTS: `public.bounties` and `public.submissions` were
-- both created with `create table if not exists` back in 0001/0002.
-- On this project's live database, tables with those two names already
-- existed (an earlier, smaller-shaped version of each) before 0001/0002
-- ever ran — so `create table if not exists` correctly saw a table
-- already there and silently did nothing, and the newer columns those
-- migrations described were never actually added. This is the exact
-- same class of drift already hit (and fixed) for `profiles` in
-- 0014/0018/0019 and for `events` in 0021/0024 — it just never got
-- applied to bounties/submissions until now.
--
-- Confirmed directly against the live schema cache (PostgREST) before
-- writing this file: `public.bounties` is missing project_name,
-- logo_url, website, twitter, discord, contact_email, skills_needed,
-- reward — exactly the columns HostBounty.tsx's insert sends, which is
-- why every bounty submission fails with a PGRST204 "column not found"
-- error. `public.submissions` is missing application_id, x_post_link,
-- google_docs_link, website_link, file_url, additional_notes — exactly
-- what SubmissionModal.tsx sends, for the same reason.
--
-- Every statement below is additive and idempotent (ADD COLUMN IF NOT
-- EXISTS / DROP+CREATE POLICY to the exact existing definition) — no
-- table, column, row, or constraint is dropped or altered destructively.
-- Both tables were empty on production at the time this was written
-- (one harmless diagnostic test row, title "diag-grant-test-2", was
-- inserted into bounties while confirming this bug — safe to reject/
-- delete from the admin panel). The NOT NULL columns below add a
-- temporary '' default first specifically so this is safe to run
-- regardless of whether any row exists by the time you run it — no
-- existing row can violate the constraint.
-- =====================================================================

alter table public.bounties
  add column if not exists project_name text not null default '',
  add column if not exists logo_url text,
  add column if not exists website text,
  add column if not exists twitter text,
  add column if not exists discord text,
  add column if not exists contact_email text not null default '',
  add column if not exists skills_needed text,
  add column if not exists reward text not null default '';

-- Drop the temporary defaults now that every row (there are none yet)
-- is guaranteed to have a real value going forward — new inserts must
-- supply these explicitly, matching the original 0001/0002 intent.
alter table public.bounties
  alter column project_name drop default,
  alter column contact_email drop default,
  alter column reward drop default;

alter table public.submissions
  add column if not exists application_id uuid references public.applications (id) on delete set null,
  add column if not exists x_post_link text,
  add column if not exists google_docs_link text,
  add column if not exists website_link text,
  add column if not exists file_url text,
  add column if not exists additional_notes text;

-- ---------------------------------------------------------------------
-- Re-assert bounties RLS (no-op if already correct — identical to the
-- policies 0001/0002 already defined; included defensively so a
-- self-healing re-run always converges on the right policies, the same
-- pattern 0018 used for profiles).
-- ---------------------------------------------------------------------
alter table public.bounties enable row level security;

drop policy if exists "approved bounties are public" on public.bounties;
create policy "approved bounties are public"
  on public.bounties for select
  using (status = 'approved' or public.is_admin());

drop policy if exists "anyone can submit a bounty as pending" on public.bounties;
create policy "anyone can submit a bounty as pending"
  on public.bounties for insert
  with check (status = 'pending');

drop policy if exists "admins manage bounties" on public.bounties;
create policy "admins manage bounties"
  on public.bounties for update
  using (public.is_admin());

drop policy if exists "admins delete bounties" on public.bounties;
create policy "admins delete bounties"
  on public.bounties for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- Force PostgREST to drop its cached schema and pick up the new columns
-- immediately, rather than waiting on auto-detection (same fix 0014/
-- 0018 used for this exact class of "column ... does not exist" error).
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table dropped, no existing column altered/removed, no user
-- data touched (both tables are empty). bounties/submissions now match
-- what the frontend has always sent.
-- =====================================================================
