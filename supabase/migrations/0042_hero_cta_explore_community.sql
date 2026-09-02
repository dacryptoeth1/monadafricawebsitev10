-- =====================================================================
-- Monad Africa — 0042: Hero CTA defaults for the 4-pillar redesign
-- (Explore / Builders / Opportunities / Community)
--
-- 0041_refresh_hero_cta_defaults.sql moved the hero buttons to
-- 'Join Monad Africa' -> /signup / 'Explore Opportunities' -> /bounties
-- for a homepage that had its own persistent "Join Monad Africa" header
-- button removed. This redesign restores a dedicated header CTA (see
-- Layout.tsx's JoinCta), so the hero itself goes back to matching the
-- reference interface: 'Explore the Ecosystem' -> /explore and
-- 'Join the Community' -> /community.
--
-- Same safe pattern as 0041: this UPDATEs the live row ONLY IF it still
-- has every one of the exact values 0041 set (i.e. an admin never
-- touched it via Admin -> Homepage since then) — a real admin
-- customization is never overwritten.
-- =====================================================================

alter table public.site_content
  alter column hero_primary_label set default 'Explore the Ecosystem',
  alter column hero_primary_href set default '/explore',
  alter column hero_secondary_label set default 'Join the Community',
  alter column hero_secondary_href set default '/community';

update public.site_content
set
  hero_primary_label = 'Explore the Ecosystem',
  hero_primary_href = '/explore',
  hero_secondary_label = 'Join the Community',
  hero_secondary_href = '/community'
where id = 1
  and hero_primary_label = 'Join Monad Africa'
  and hero_primary_href = '/signup'
  and hero_secondary_label = 'Explore Opportunities'
  and hero_secondary_href = '/bounties';
