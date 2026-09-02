-- =====================================================================
-- Monad Africa — 0041: Refresh the hero CTA defaults for the
-- "Get Started" homepage redesign
--
-- 0005_admin_control_panel.sql seeded site_content(id=1) with only
-- `id` set, so every hero_* column took its column DEFAULT:
--   hero_primary_label   = 'Explore Bounties'
--   hero_primary_href    = '/bounties'
--   hero_secondary_label = 'Join Community'
--   hero_secondary_href  = 'discord'
-- The redesigned hero now expects the primary button to be a
-- sign-up/get-started CTA and the secondary to be "Explore
-- Opportunities" — this UPDATEs the live row ONLY IF it still has
-- every one of those exact original values (i.e. an admin never
-- touched it via Admin → Homepage), so a real admin customization is
-- never overwritten. The column DEFAULTs are also updated so a fresh
-- install seeds sensible copy going forward.
-- =====================================================================

alter table public.site_content
  alter column hero_primary_label set default 'Join Monad Africa',
  alter column hero_primary_href set default '/signup',
  alter column hero_secondary_label set default 'Explore Opportunities',
  alter column hero_secondary_href set default '/bounties';

update public.site_content
set
  hero_primary_label = 'Join Monad Africa',
  hero_primary_href = '/signup',
  hero_secondary_label = 'Explore Opportunities',
  hero_secondary_href = '/bounties'
where id = 1
  and hero_primary_label = 'Explore Bounties'
  and hero_primary_href = '/bounties'
  and hero_secondary_label = 'Join Community'
  and hero_secondary_href = 'discord';
