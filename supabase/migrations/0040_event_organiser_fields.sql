-- =====================================================================
-- Monad Africa — 0040: Event organiser name + logo
--
-- The redesigned homepage's "Upcoming Events" section shows each
-- event's official organiser logo (per the Monad Africa brand/design
-- brief). `events` had no column for this before — additive, nullable
-- columns only, no existing row or column is touched/removed, and the
-- admin event editor (AdminEventRegistrations.tsx) is updated
-- separately to fill them in.
-- =====================================================================

alter table public.events
  add column if not exists organiser_name text,
  add column if not exists organiser_logo_url text;

comment on column public.events.organiser_name is 'Display name of the event''s organiser (e.g. "Monad Africa", "KoraPay"). Falls back to "Monad Africa" in the UI when blank.';
comment on column public.events.organiser_logo_url is 'URL of the organiser''s logo, shown on the public event card. Falls back to initials when blank.';
