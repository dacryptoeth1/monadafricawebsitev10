-- =====================================================================
-- Monad Africa — 0054: Explore Builders public fields + Singapore
-- "Open" event corrections.
--
-- Everything here is additive/corrective. No table is dropped, no
-- column removed, no existing row deleted. Safe to re-run.
--
-- Backs two things:
--
--   1. Explore Builders (/builders, and every other place BuilderCard
--      is used) needs a builder's project/company, short bio, X link
--      and website to render a real, complete card — instead of only
--      name/country/XP. `bio`/`twitter`/`website` already exist on
--      `profiles` (editable today on /profile) but were never exposed
--      through `leaderboard_public`, the only profile data a logged-out
--      visitor may read. `project_or_company` is a genuinely new column
--      — nothing existing captured "what are you building" before.
--      Added to the END of the view's column list, which is the only
--      shape of change CREATE OR REPLACE VIEW permits, so nothing
--      selecting from it today can break.
--
--   2. The "Open" event (Monad Foundation's Token2049-week Singapore
--      event) was first added in migration 0050 with a placeholder X
--      link and no organiser logo. Corrected here to the real X
--      announcement and the real Monad logo asset already shipped in
--      this project (public/brand/monad-logo-white.png — the same file
--      MonadOfficialBadge.tsx uses elsewhere as "the actual official
--      Monad logo"). Guarded so this runs whether 0050 already created
--      the row or not.
-- =====================================================================

set lock_timeout = '5s';

-- ---------------------------------------------------------------------
-- 1. profiles.project_or_company — a builder's project or company, self-
--    set on their own profile (see src/pages/Profile.tsx). Nullable:
--    most existing rows simply don't have one yet.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists project_or_company text;

-- ---------------------------------------------------------------------
-- 2. Expose bio/twitter/website/project_or_company on the public view.
--    Still no PII beyond what a builder already chose to publish on
--    their own public-facing card: no email, wallet address,
--    telegram/discord handles, or suspension/ban flags.
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
  role,
  bio,
  twitter,
  website,
  project_or_company
from public.profiles
where hide_from_leaderboard = false;

grant select on public.leaderboard_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. The "Open" event — insert if migration 0050 never ran on this
--    database, then correct every field on it either way.
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists is_external boolean not null default false,
  add column if not exists x_url text;

insert into public.events (
  title, description, event_date, event_type, location,
  organiser_name, event_url, x_url, organiser_logo_url, is_external, registration_open, status
)
select
  'Open',
  'Monad Foundation''s official Token2049-week event in Singapore.',
  '2026-10-06', 'Conference', 'Singapore',
  'Monad Foundation', 'https://luma.com/open-2026', 'https://x.com/monad/status/2084625530112897230?s=46',
  '/brand/monad-logo-white.png',
  true, false, 'published'
where not exists (select 1 from public.events where title = 'Open' and event_date = '2026-10-06');

update public.events
set
  description = 'Monad Foundation''s official Token2049-week event in Singapore.',
  event_type = 'Conference',
  location = 'Singapore',
  organiser_name = 'Monad Foundation',
  event_url = 'https://luma.com/open-2026',
  x_url = 'https://x.com/monad/status/2084625530112897230?s=46',
  organiser_logo_url = '/brand/monad-logo-white.png',
  is_external = true,
  status = 'published'
where title = 'Open' and event_date = '2026-10-06';

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. `public.profiles`/`public.events`, their RLS policies, and
-- every column not listed above are untouched.
-- =====================================================================
