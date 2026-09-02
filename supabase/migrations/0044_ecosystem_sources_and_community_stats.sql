-- =====================================================================
-- Monad Africa — 0044: Ecosystem sources + community stats history
--
-- Two independent additions, both additive (no existing table touched):
--
-- 1. ecosystem_sources — a structured registry of verified Monad
--    ecosystem projects (Monorail, Perpl, Chog, etc.) that
--    ecosystem_activity (0043) entries can be attributed to, instead of
--    every card only carrying a free-text source_name. Lets an admin
--    add more verified projects later without touching the Events page
--    at all (per the redesign brief's "don't limit the system to six
--    sources" requirement).
--
-- 2. community_stats — real, timestamped snapshots of Monad Africa's
--    own Discord/Telegram counts, written only by a scheduled GitHub
--    Actions job (scripts/sync-community-stats.mjs, triggered by
--    .github/workflows/sync-community-stats.yml, using the platforms'
--    own bot APIs) — never hand-edited by an admin, per the redesign
--    brief's "platform data must be the source of truth, not manually
--    editable" rule (RLS
--    below has no admin write policy on purpose, only a service-role
--    bypass). site_settings' existing manual x_followers/discord_members/
--    telegram_members fields stay exactly as they are, as the fallback
--    shown when no real snapshot exists yet for a platform.
-- =====================================================================

create table if not exists public.ecosystem_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  handle text,
  category text,
  website text,
  logo_url text,
  description text,
  location text,
  -- 'priority' = the six sources the redesign brief calls out by name;
  -- 'verified' = any other confirmed real ecosystem project an admin
  -- adds later. Free text (not a hard enum) so a new tier can be
  -- introduced without a migration.
  source_type text not null default 'verified',
  is_active boolean not null default true,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ecosystem_sources
  add column if not exists name text,
  add column if not exists handle text,
  add column if not exists category text,
  add column if not exists website text,
  add column if not exists logo_url text,
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists source_type text not null default 'verified',
  add column if not exists is_active boolean not null default true,
  add column if not exists last_checked_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_ecosystem_sources_updated_at on public.ecosystem_sources;
create trigger trg_ecosystem_sources_updated_at before update on public.ecosystem_sources
  for each row execute function public.set_updated_at();

alter table public.ecosystem_sources enable row level security;

drop policy if exists "ecosystem sources are public" on public.ecosystem_sources;
create policy "ecosystem sources are public" on public.ecosystem_sources for select
  using (is_active = true or public.is_admin());

drop policy if exists "admins manage ecosystem sources" on public.ecosystem_sources;
create policy "admins manage ecosystem sources" on public.ecosystem_sources for all
  using (public.is_admin()) with check (public.is_admin());

-- The six priority sources named in the redesign brief. Details beyond
-- name/handle/category are left blank rather than guessed — an admin
-- fills in a verified website/logo/description via Admin -> Ecosystem
-- Sources once confirmed, instead of this migration inventing them.
insert into public.ecosystem_sources (name, handle, category, source_type)
select * from (values
  ('Monorail', '@monorail_xyz', 'DEX Aggregator', 'priority'),
  ('Monad Dev', '@monad_dev', 'Official', 'priority'),
  ('DeltaV', '@deltav_xyz', 'Ecosystem Project', 'priority'),
  ('Perpl', '@perpltrade', 'Perpetuals Exchange', 'priority'),
  ('Chog', '@chognft', 'NFT / Community', 'priority'),
  ('Build Anything', '@buildanythingso', 'Ecosystem Project', 'priority')
) as seed(name, handle, category, source_type)
where not exists (
  select 1 from public.ecosystem_sources es where es.handle = seed.handle
);

-- ---------------------------------------------------------------------
create table if not exists public.community_stats (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  count integer not null,
  -- Always 'api' in practice (scripts/sync-community-stats.mjs calls
  -- each platform's authenticated bot API) — free text rather than a
  -- hard enum so a future source type doesn't need a migration. A
  -- failed sync writes NO row at all (see that script) rather than an
  -- 'unavailable' placeholder, so every row here is a real count.
  source text not null default 'api',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.community_stats
  add column if not exists platform text,
  add column if not exists count integer,
  add column if not exists source text not null default 'api',
  add column if not exists recorded_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.community_stats drop constraint if exists community_stats_platform_check;
alter table public.community_stats add constraint community_stats_platform_check
  check (platform in ('x', 'discord', 'telegram'));

create index if not exists idx_community_stats_platform_recorded on public.community_stats (platform, recorded_at desc);

alter table public.community_stats enable row level security;

-- Public read (this is what powers the homepage/Community page stat
-- cards and growth deltas) — but deliberately NO insert/update/delete
-- policy at all, not even for admins: every write to this table comes
-- from scripts/sync-community-stats.mjs (run by GitHub Actions) using
-- the service-role key, which
-- bypasses RLS entirely. That's what makes "platform data is the
-- source of truth, not manually editable" actually true rather than
-- just a comment — there is no UI path, admin or otherwise, that can
-- write a row here.
drop policy if exists "community stats are public" on public.community_stats;
create policy "community stats are public" on public.community_stats for select
  using (true);
