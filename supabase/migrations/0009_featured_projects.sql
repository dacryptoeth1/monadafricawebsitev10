-- =====================================================================
-- Monad Africa — 0009: Featured Projects carousel support
-- Run in Supabase SQL Editor AFTER 0001-0008.
-- =====================================================================

alter table public.projects add column if not exists is_featured boolean not null default false;

-- =====================================================================
-- Done.
-- =====================================================================
