-- =====================================================================
-- Monad Africa — 0008: Fix blank Credits card (NULL credits backfill)
-- Run in Supabase SQL Editor AFTER 0001-0007.
--
-- The Credits card was rendering blank because profiles.credits was
-- NULL for some rows. The column was always intended to be
-- `not null default 3`, but across several rounds of migrations it's
-- possible that constraint never actually landed on every row (or on
-- rows created before it existed). This migration is fully defensive:
-- it doesn't assume any prior state, just guarantees the end result.
-- =====================================================================

-- 1. Backfill: any row with NULL credits gets 3.
update public.profiles set credits = 3 where credits is null;

-- 2. Make sure the default is 3 for future inserts (idempotent).
alter table public.profiles alter column credits set default 3;

-- 3. Make sure the column can never be NULL again (idempotent — if this
--    constraint already exists, re-running it is a harmless no-op).
alter table public.profiles alter column credits set not null;

-- =====================================================================
-- Done. Every existing row now has a real integer in credits, and no
-- future row can be inserted without one.
-- =====================================================================
