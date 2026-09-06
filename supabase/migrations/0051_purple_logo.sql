-- =====================================================================
-- Monad Africa — 0051: Purple project logo
-- Run in Supabase SQL Editor AFTER 0050.
-- The real Purple logo (references/purple.jpeg) was supplied after
-- 0050 had already been run, so it's set here instead of editing an
-- already-applied migration. Points at /brand/purple-logo.jpg — a
-- root-relative path served by the site's own deployed origin (same
-- convention as the homepage hero's /brand/africa-network-map-purple.webp),
-- not a separate hosted URL.
-- =====================================================================
update public.projects
set logo_url = '/brand/purple-logo.jpg'
where name = 'Purple' and logo_url is null;
