-- =====================================================================
-- Monad Africa — 0043: Ecosystem activity intelligence
--
-- Backs the redesigned /events page: "what is happening across Monad
-- right now" (global ecosystem activity, e.g. a TVL stat kept in sync
-- from DefiLlama's public API, or a real Monad blog post) PLUS African
-- Monad activity Monad Africa itself curates (hackathons, meetups,
-- activations) — NOT a replacement for the existing `events` table,
-- which stays exactly as-is for actual registerable Monad Africa
-- events (registration, invite codes, check-in all untouched).
--
-- `data_freshness` is what drives the UI's "Live" / "Updated Xm ago" /
-- "Curated" labeling (see EcosystemActivity in src/types.ts) — the
-- point is that nothing gets labeled "Live" unless it's genuinely kept
-- in sync by a scheduled job (see api/sync-ecosystem-tvl.ts):
--   'live'    — a scheduled job refreshes this row's value/timestamp
--               on its own schedule (currently: Monad chain TVL via
--               DefiLlama's public API, every 6h via Vercel Cron).
--   'periodic' — reserved for a future scheduled source that isn't
--               continuously live but does get refreshed on a cadence.
--   'curated' — an admin entered/verified this by hand, with a real
--               source_url. This is the honest default for anything
--               without a genuine automated feed (per the redesign
--               brief: no invented statistics, no fake "live" labels).
-- =====================================================================

create table if not exists public.ecosystem_activity (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- Free text, same convention as events.event_type (0002) — not a
  -- fixed enum, so admins aren't blocked by an unanticipated category.
  category text,
  status text not null default 'recent',
  -- 'global' = wider Monad ecosystem, 'africa' = specifically African
  -- Monad activity — the two questions the redesigned page answers.
  region text not null default 'global',
  location text,
  country text,
  city text,
  latitude double precision,
  longitude double precision,
  source_url text,
  source_name text,
  image_url text,
  statistic_value text,
  statistic_label text,
  data_freshness text not null default 'curated',
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  -- Set only by the automated sync job — null for anything hand-curated.
  last_synced_at timestamptz,
  created_by uuid references public.admins (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ecosystem_activity
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists status text not null default 'recent',
  add column if not exists region text not null default 'global',
  add column if not exists location text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists source_url text,
  add column if not exists source_name text,
  add column if not exists image_url text,
  add column if not exists statistic_value text,
  add column if not exists statistic_label text,
  add column if not exists data_freshness text not null default 'curated',
  add column if not exists is_published boolean not null default true,
  add column if not exists published_at timestamptz not null default now(),
  add column if not exists last_synced_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.ecosystem_activity drop constraint if exists ecosystem_activity_status_check;
alter table public.ecosystem_activity add constraint ecosystem_activity_status_check
  check (status in ('live', 'upcoming', 'recent'));

alter table public.ecosystem_activity drop constraint if exists ecosystem_activity_region_check;
alter table public.ecosystem_activity add constraint ecosystem_activity_region_check
  check (region in ('global', 'africa'));

alter table public.ecosystem_activity drop constraint if exists ecosystem_activity_freshness_check;
alter table public.ecosystem_activity add constraint ecosystem_activity_freshness_check
  check (data_freshness in ('live', 'periodic', 'curated'));

create index if not exists idx_ecosystem_activity_published on public.ecosystem_activity (is_published, published_at desc);
create index if not exists idx_ecosystem_activity_region on public.ecosystem_activity (region);

-- set_updated_at() already exists (0016_events_table_unification.sql).
drop trigger if exists trg_ecosystem_activity_updated_at on public.ecosystem_activity;
create trigger trg_ecosystem_activity_updated_at before update on public.ecosystem_activity
  for each row execute function public.set_updated_at();

alter table public.ecosystem_activity enable row level security;

drop policy if exists "ecosystem activity is public" on public.ecosystem_activity;
create policy "ecosystem activity is public" on public.ecosystem_activity for select
  using (is_published = true or public.is_admin());

drop policy if exists "admins manage ecosystem activity" on public.ecosystem_activity;
create policy "admins manage ecosystem activity" on public.ecosystem_activity for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Seed: real, verified rows only — nothing invented.
--   1. The Monad chain TVL stat, seeded with the real figure read from
--      DefiLlama's public API at the time this migration was written
--      (https://api.llama.fi/v2/historicalChainTvl/Monad), so the page
--      isn't empty before the sync job's first run. A fixed id lets the
--      sync function upsert this exact row going forward instead of
--      inserting duplicates.
--   2. Three real Monad ecosystem blog posts (title/URL/date verified
--      against monad.xyz/blog directly), as example "curated" global
--      activity.
-- No African-region rows are seeded — Monad Africa has no real activity
-- data yet to publish here; an admin adds real ones via Admin ->
-- Ecosystem Activity as they happen, each backed by a source URL.
-- ---------------------------------------------------------------------
insert into public.ecosystem_activity
  (id, title, description, category, status, region, source_url, source_name, statistic_value, statistic_label, data_freshness, published_at, last_synced_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'Monad Ecosystem TVL',
    'Total value locked across DeFi protocols on Monad.',
    'Statistic', 'live', 'global',
    'https://defillama.com/chain/monad', 'DefiLlama',
    '$956.9M', 'Monad Ecosystem TVL', 'live', now(), now()
  )
on conflict (id) do nothing;

insert into public.ecosystem_activity
  (title, description, category, status, region, source_url, source_name, data_freshness, published_at)
select * from (values
  (
    'Highlights from the Monad Ecosystem: August 2026',
    'Monad''s monthly roundup of ecosystem activity, launches, and milestones.',
    'Ecosystem Update', 'recent', 'global',
    'https://monad.xyz/blog/monad-ecosystem-highlights-august-2026', 'Monad Blog', 'curated', '2026-09-02T00:00:00Z'::timestamptz
  ),
  (
    'Behind Monad''s 100% Uptime',
    'A look at the infrastructure and engineering behind Monad mainnet''s uptime record.',
    'Ecosystem Update', 'recent', 'global',
    'https://monad.xyz/blog/monad-network-uptime', 'Monad Blog', 'curated', '2026-08-31T00:00:00Z'::timestamptz
  ),
  (
    'Open by Construction — Monad''s Mission',
    'Monad on why open access to financial markets is core to its design.',
    'Ecosystem Update', 'recent', 'global',
    'https://monad.xyz/blog/open-by-construction', 'Monad Blog', 'curated', '2026-08-10T00:00:00Z'::timestamptz
  )
) as seed(title, description, category, status, region, source_url, source_name, data_freshness, published_at)
where not exists (
  select 1 from public.ecosystem_activity ea where ea.source_url = seed.source_url
);
