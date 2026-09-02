-- =====================================================================
-- Monad Africa — 0046: Ecosystem Pulse category tagging
--
-- Small, additive follow-up to 0043/0045 — no new tables. The rebuilt
-- /events "Ecosystem Pulse" page needs to distinguish registerable
-- Events (conferences/hackathons/workshops/meetups — that's the
-- existing `events` table, untouched) from Ecosystem Updates
-- (launches/integrations/milestones/announcements — `ecosystem_activity`
-- rows) using an explicit field, not a keyword guess against the
-- freeform `category` text column. `pulse_category` is that explicit
-- field — nullable (existing/future rows aren't forced to have one; an
-- uncategorized row just doesn't show up under a Builders/Ecosystem/
-- Community filter chip, which is honest, not a bug) and constrained to
-- a small closed set so the filter chips on the page stay meaningful.
-- =====================================================================

alter table public.ecosystem_activity
  add column if not exists pulse_category text;

alter table public.ecosystem_activity drop constraint if exists ecosystem_activity_pulse_category_check;
alter table public.ecosystem_activity add constraint ecosystem_activity_pulse_category_check
  check (pulse_category is null or pulse_category in ('event', 'announcement', 'network', 'builder', 'ecosystem', 'community'));

create index if not exists idx_ecosystem_activity_pulse_category on public.ecosystem_activity (pulse_category);

-- Backfill the 4 rows seeded by 0043, classified from their own real,
-- already-verified `category` value (Statistic / Ecosystem Update) —
-- not a new judgment call, just making that existing classification
-- queryable by the new filter chips.
update public.ecosystem_activity
set pulse_category = 'ecosystem'
where pulse_category is null
  and category in ('Statistic', 'Ecosystem Update');
