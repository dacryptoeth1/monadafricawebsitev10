-- =====================================================================
-- Monad Africa — 0050: Daily check-in XP, project founder fields +
-- Purple project, external event support + Monad Foundation Singapore
-- event, homepage hero copy correction.
-- Run in Supabase SQL Editor AFTER 0001-0049.
-- Self-contained (IF NOT EXISTS / OR REPLACE / guarded INSERTs
-- throughout) — safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. DAILY CHECK-IN — one calendar-day-gated +1 XP action per user.
--    `last_checkin_date` is a plain `date` (no time component), so
--    "today" is always compared as a calendar date, never a rolling
--    24-hour window. `checkin_streak` is a display-only counter (the
--    brief explicitly asks for a streak indicator with NO extra XP for
--    it) — it resets to 1 whenever a day is missed.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_checkin_date date,
  add column if not exists checkin_streak int not null default 0;

alter table public.profiles drop constraint if exists profiles_checkin_streak_non_negative;
alter table public.profiles add constraint profiles_checkin_streak_non_negative check (checkin_streak >= 0);

-- Admin-configurable, same pattern as every other XP amount (see
-- xp_reward_config in 0010) — defaults to exactly 1, as specified.
insert into public.xp_reward_config (key, label, amount) values
  ('daily_checkin', 'Daily Check-in', 1)
on conflict (key) do nothing;

-- The ONLY entry point for the check-in action — callable directly by
-- a signed-in user (unlike grant_xp itself), but every check is
-- re-verified against the row already on the server, exactly like
-- claim_wallet_connect_bonus / claim_profile_completion_bonus above:
-- the client can call this as many times as it likes in a day, only
-- the first call each calendar date (UTC) ever changes anything.
create or replace function public.daily_checkin()
returns table (
  success boolean,
  already_checked_in boolean,
  xp int,
  checkin_streak int,
  checkin_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_new_streak int;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.last_checkin_date = v_today then
    return query select false, true, v_profile.xp, v_profile.checkin_streak, v_today;
    return;
  end if;

  -- Streak continues only if the last check-in was exactly yesterday;
  -- any earlier date (or none at all) starts a fresh streak of 1.
  v_new_streak := case when v_profile.last_checkin_date = v_today - 1 then v_profile.checkin_streak + 1 else 1 end;

  update public.profiles
  set last_checkin_date = v_today, checkin_streak = v_new_streak
  where id = auth.uid();

  perform public.grant_xp(auth.uid(), public.xp_reward('daily_checkin'), 'daily_checkin:' || v_today::text);

  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Daily check-in complete', '+' || public.xp_reward('daily_checkin') || ' XP — come back tomorrow to keep your streak going.');

  select * into v_profile from public.profiles where id = auth.uid();

  return query select true, false, v_profile.xp, v_profile.checkin_streak, v_today;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. PROJECTS: founder fields (additive — every existing project row
--    simply has these as null until an admin fills them in) + the real
--    Purple project row, guarded so re-running this migration never
--    creates a duplicate.
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists founder_name text,
  add column if not exists founder_x text,
  add column if not exists country text;

insert into public.projects (name, category, description, founder_name, founder_x, country, is_featured)
select 'Purple', 'Infrastructure / Ecosystem',
  'Infrastructure and ecosystem tooling for Monad, built by the Monad Africa community.',
  'CryptoTester', 'https://x.com/cryptotesteer?s=11', 'Africa', false
where not exists (select 1 from public.projects where name = 'Purple');
-- `website` is intentionally left null — no official Purple site URL
-- was supplied. The column already exists and is admin-editable from
-- Admin → Ecosystem Projects; the project card/modal both already
-- render "no website" the same honest way every other linkless project
-- does (no dead "#" link), so this needs no further schema change once
-- a real URL is ready to add.

-- ---------------------------------------------------------------------
-- 3. EVENTS: external-event support. Some events (e.g. a Monad
--    Foundation event happening elsewhere) are informational only —
--    Monad Africa isn't collecting registrations for them, so they
--    must never force a visitor through the login-gated registration
--    flow just to see the details. `x_url` is the event's X/Twitter
--    announcement link, shown alongside `event_url` (the official page)
--    in a dedicated external-event view instead of a registration form.
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists is_external boolean not null default false,
  add column if not exists x_url text;

insert into public.events (
  title, description, event_date, event_type, location,
  organiser_name, event_url, x_url, is_external, registration_open, status
)
select
  'Open',
  'Monad Foundation''s official Token2049-week event in Singapore.',
  '2026-10-06', 'Conference', 'Singapore',
  'Monad Foundation', 'https://luma.com/open-2026', 'https://x.com/monad_dev/status/2094827590695456849?s=46',
  true, false, 'published'
where not exists (select 1 from public.events where title = 'Open' and event_date = '2026-10-06');

-- ---------------------------------------------------------------------
-- 4. HOMEPAGE HERO COPY — corrected per the co-founder's explicit
--    instruction. Only touches hero_title; every other site_content
--    field (subtitle, CTA labels/links, footer, roadmap, FAQ) is left
--    exactly as an admin last set it.
-- ---------------------------------------------------------------------
update public.site_content
set hero_title = 'Africa is building on Monad.'
where id = 1;

-- =====================================================================
-- Done.
-- =====================================================================
