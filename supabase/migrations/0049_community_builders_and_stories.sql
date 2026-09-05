-- =====================================================================
-- Monad Africa — 0049: community-driven homepage
--
-- Everything here is additive. No table is dropped, no column removed,
-- no existing row rewritten. Safe to re-run.
--
-- Backs four things the marketing-lead review asked for:
--
--   1. "Featured Builders" showing REAL registered community members
--      instead of the Monad Africa team roster. The data already
--      existed (profiles.xp, profiles.country, profiles.role) — but
--      `leaderboard_public`, the only profile data a logged-out
--      visitor may read, didn't expose `role`, so a builder card had
--      nothing to show under the name. Added to the END of the view's
--      column list, which is the only shape of change CREATE OR REPLACE
--      VIEW permits, so nothing selecting from it today can break.
--
--   2. Community Stories — a genuinely new content type with no
--      existing table to reuse (unlike Monad Spaces, which are just
--      `events` rows whose event_type mentions a Space, so they need
--      no schema at all). Kept deliberately small.
--
--   3. `ecosystem_activity.pulse_category` — migration 0046 defined
--      this and the /events filter chips already read it, but it is
--      missing from the live database, so those chips silently match
--      nothing. Re-stated here idempotently.
--
--   4. `projects.category` — declared in 0001 and written by Admin →
--      Ecosystem Projects, likewise missing from the live database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Expose the builder's self-selected role on the public view.
--    Still no PII: `role` is the same one-word public label
--    ('Developer' / 'Designer' / 'Community Member' / ...) a builder
--    picks at signup, already shown on their own profile.
-- ---------------------------------------------------------------------
create or replace view public.leaderboard_public as
select
  id,
  username,
  full_name,
  avatar_url,
  country,
  xp,
  total_referrals,
  role
from public.profiles
where hide_from_leaderboard = false;

grant select on public.leaderboard_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Community Stories.
--    Admin-curated (Admin → Community Stories), public read once
--    published. Author fields are plain text rather than a profiles FK
--    on purpose: a story can legitimately be about or by someone who
--    has no account on the platform, and copying a display name is not
--    the same as inventing a user row.
-- ---------------------------------------------------------------------
create table if not exists public.community_stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text,
  body text,
  cover_image_url text,
  author_name text,
  author_avatar_url text,
  -- Plain country NAME, matching profiles.country, so the same flag
  -- lookup (src/lib/countryFlag.ts) works without a second convention.
  author_country text,
  -- Where "Read story" goes when the story lives off-site (X thread,
  -- Mirror, blog). Null = the excerpt on the Community page is the
  -- whole story.
  link text,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid references public.admins (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-stated for a database where the table already exists from a
-- partial earlier run.
alter table public.community_stories
  add column if not exists excerpt text,
  add column if not exists body text,
  add column if not exists cover_image_url text,
  add column if not exists author_name text,
  add column if not exists author_avatar_url text,
  add column if not exists author_country text,
  add column if not exists link text,
  add column if not exists is_published boolean not null default true,
  add column if not exists published_at timestamptz not null default now(),
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_community_stories_published
  on public.community_stories (is_published, published_at desc);

alter table public.community_stories enable row level security;

drop policy if exists "community stories are public" on public.community_stories;
create policy "community stories are public" on public.community_stories for select
  using (is_published = true or public.is_admin());

drop policy if exists "admins manage community stories" on public.community_stories;
create policy "admins manage community stories" on public.community_stories for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.community_stories to anon, authenticated;
grant insert, update, delete on public.community_stories to authenticated;

-- ---------------------------------------------------------------------
-- 3. ecosystem_activity.pulse_category (restated from 0046).
-- ---------------------------------------------------------------------
alter table public.ecosystem_activity
  add column if not exists pulse_category text;

alter table public.ecosystem_activity drop constraint if exists ecosystem_activity_pulse_category_check;
alter table public.ecosystem_activity add constraint ecosystem_activity_pulse_category_check
  check (pulse_category is null or pulse_category in ('event', 'announcement', 'network', 'builder', 'ecosystem', 'community'));

create index if not exists idx_ecosystem_activity_pulse_category on public.ecosystem_activity (pulse_category);

update public.ecosystem_activity
set pulse_category = 'ecosystem'
where pulse_category is null
  and category in ('Statistic', 'Ecosystem Update');

-- ---------------------------------------------------------------------
-- 4. projects.category (restated from 0001).
-- ---------------------------------------------------------------------
alter table public.projects add column if not exists category text;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done.
-- =====================================================================
