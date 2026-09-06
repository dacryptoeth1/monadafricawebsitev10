-- =====================================================================
-- Monad Africa — 0052: Purple's own X account + real website
-- Run in Supabase SQL Editor AFTER 0051.
--
-- Purple's founder (CryptoTester) and Purple's own project account are
-- two different X handles — founder_x (added in 0050) already holds
-- the founder's, so this adds a separate project_x column for the
-- project's own, plus finally sets a real website now that one has
-- been supplied (was left null in 0050 — see that file's comment).
-- =====================================================================
alter table public.projects
  add column if not exists project_x text;

update public.projects
set project_x = 'https://x.com/purple_layeer?s=11',
    website = 'https://purple-layer.com/'
where name = 'Purple';
