-- =====================================================================
-- Monad Africa — 0048: CryptoTesteer role change, BD lead removed
--
-- CryptoTesteer stops being the site's BD/partnership contact — the
-- Partners page (src/pages/Partners.tsx) now has its own proposal form
-- as that contact mechanism instead of pointing at one person. His
-- team_members row is updated to reflect his actual current role and
-- to no longer be flagged as the BD lead.
--
-- This is a plain data update on an existing table (no schema change)
-- — matched by name, not id, same as this table's other admin-content
-- migrations. Guarded so re-running this file is a no-op once applied.
-- =====================================================================

update public.team_members
set primary_role = 'Co-founder · Marketing Lead',
    is_bd_lead = false
where name = 'CryptoTester'
  and (primary_role <> 'Co-founder · Marketing Lead' or is_bd_lead <> false);
