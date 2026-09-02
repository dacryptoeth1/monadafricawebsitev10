-- =====================================================================
-- Monad Africa — 0045: Link ecosystem_activity to ecosystem_sources
--
-- Small, additive follow-up to 0043/0044 — no new tables. Lets an
-- ecosystem_activity entry properly attribute to a registered source
-- (with its own logo/category/website) instead of only carrying a
-- free-text source_name/source_url. Both stay as-is for anything not
-- yet registered as a formal source (or an ad-hoc link), so nothing
-- existing breaks — source_id is purely additive.
-- =====================================================================

alter table public.ecosystem_activity
  add column if not exists source_id uuid references public.ecosystem_sources (id) on delete set null;

create index if not exists idx_ecosystem_activity_source on public.ecosystem_activity (source_id);

-- Official Monad itself wasn't in the six named "priority" sources
-- (Monorail/Monad Dev/DeltaV/Perpl/Chog/Build Anything are all already
-- seeded by 0044) — added here as source_type 'official' per the "1.
-- Official Monad sources" priority rule. Real, verified: monad.xyz/blog
-- and monad.xyz/announcements, checked directly against the live site.
insert into public.ecosystem_sources (name, handle, category, website, source_type)
select * from (values
  ('Monad', null, 'Official', 'https://monad.xyz', 'official')
) as seed(name, handle, category, website, source_type)
where not exists (select 1 from public.ecosystem_sources es where es.name = seed.name);

-- Backfill: the three curated Monad Blog posts seeded by 0043 all
-- predate this source registry existing — link them to the official
-- Monad source now that it exists, matched by their real source_url
-- domain (monad.xyz), not by guessing.
update public.ecosystem_activity ea
set source_id = es.id
from public.ecosystem_sources es
where es.name = 'Monad'
  and ea.source_id is null
  and ea.source_url like 'https://monad.xyz/%';
