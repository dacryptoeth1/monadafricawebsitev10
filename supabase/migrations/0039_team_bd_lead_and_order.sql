-- =====================================================================
-- Monad Africa — 0039: Enforce team ordering + single BD/Partnerships lead
-- Run in Supabase SQL Editor AFTER 0001-0038.
-- Self-contained, safe to re-run.
--
-- 0035 seeded the team in the right order and with a sole is_bd_lead,
-- but that seed only ever INSERTs (on conflict do nothing) — it never
-- corrects rows that already exist with different data, and the live
-- table has since drifted from that seed (via Admin -> Team Management):
-- the BD lead's row is named "CryptoTester" (no space, matching his
-- telegram/x handles), not the seeded "Crypto Testeer", and currently
-- sits at display_order 1 — AHEAD of the Founder. This migration UPDATEs
-- the live rows directly, matched by their stable telegram/x handles
-- rather than by display name, so it's resilient to that kind of drift:
--   1. Founder is always display_order 1, ahead of the Co-founder /
--      Business Development lead at display_order 2.
--   2. The BD lead's title reflects Co-founder + BD & Partnerships.
--   3. No other active team member's title/badges claim Business
--      Development or Partnerships — the BD lead is the sole
--      is_bd_lead (also enforced by the partial unique index in 0035).
-- =====================================================================

-- The BD lead — identified by his telegram/x handles (stable across the
-- "Crypto Testeer" vs "CryptoTester" display-name drift above).
update public.team_members
set
  primary_role = 'Co-founder · Business Development & Partnerships',
  badges = array['Co-founder', 'Business Development', 'Partnerships'],
  is_bd_lead = true,
  display_order = 2
where telegram_url ilike '%CryptoTesteer%' or x_url ilike '%cryptotesteer%';

-- The Founder — always display_order 1, ahead of the BD lead above.
update public.team_members
set display_order = 1
where primary_role ilike 'founder'
  and not (telegram_url ilike '%CryptoTesteer%' or x_url ilike '%cryptotesteer%');

-- Strip the Business Development / Partnerships title, badges, and
-- is_bd_lead flag from anyone other than the BD lead identified above,
-- so the responsibility only ever reads as belonging to one person on
-- the public /team page.
update public.team_members
set
  primary_role = case when primary_role ilike '%partnership%' or primary_role ilike '%business development%'
    then 'Community Support' else primary_role end,
  badges = array_remove(array_remove(badges, 'Partnerships'), 'Business Development'),
  is_bd_lead = false
where not (telegram_url ilike '%CryptoTesteer%' or x_url ilike '%cryptotesteer%')
  and (
    is_bd_lead
    or primary_role ilike '%partnership%'
    or primary_role ilike '%business development%'
    or 'Partnerships' = any(badges)
    or 'Business Development' = any(badges)
  );

notify pgrst, 'reload schema';

-- =====================================================================
-- Done.
-- =====================================================================
