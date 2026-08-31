-- =====================================================================
-- Monad Africa — site_settings recovery
-- Run in Supabase Dashboard → SQL Editor.
--
-- WHY THIS FILE EXISTS: the app's admin dashboard, homepage, and
-- Community page all read/write `public.site_settings`, but on this
-- project's live database the table was never actually created —
-- `0001_init.sql` and `0005_admin_control_panel.sql` both define it
-- (0001 creates it, 0005 adds the later columns), but apparently
-- weren't run against this specific database, which is why saving
-- Settings failed with "Could not find the table 'public.site_settings'
-- in the schema cache." This file recreates it standalone, with every
-- column `src/types.ts`'s `SiteSettings` interface expects, matching
-- 0001 + 0005 exactly so it's consistent with the rest of the schema.
-- Idempotent — safe to run even if some of this already exists.
-- =====================================================================

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  x_followers int not null default 130,
  x_followers_change_week int not null default 0,
  discord_members int not null default 160,
  discord_online_manual int not null default 0,
  discord_joined_today int not null default 0,
  discord_guild_id text default '',
  discord_widget_enabled boolean not null default false,
  telegram_members int not null default 0,
  telegram_members_change_today int not null default 0,
  countries_reached int not null default 4,
  builders_onboarded int not null default 30,
  community_partners int not null default 2,
  x_url text default 'https://x.com/monadonafrica',
  discord_url text default 'https://discord.gg/tjY9t3PZF',
  telegram_url text default '',
  updated_at timestamptz not null default now()
);

-- In case the table already existed from a partial run, make sure every
-- column the app expects is present (no-ops if they're already there).
alter table public.site_settings
  add column if not exists x_followers_change_week int not null default 0,
  add column if not exists discord_online_manual int not null default 0,
  add column if not exists discord_joined_today int not null default 0,
  add column if not exists discord_guild_id text default '',
  add column if not exists discord_widget_enabled boolean not null default false,
  add column if not exists telegram_members int not null default 0,
  add column if not exists telegram_members_change_today int not null default 0;

-- Seed the single settings row if it doesn't exist yet.
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- RLS: readable by everyone (public stats on the homepage/Community
-- page), writable only by admins.
alter table public.site_settings enable row level security;

drop policy if exists "settings readable by everyone" on public.site_settings;
create policy "settings readable by everyone"
  on public.site_settings for select
  using (true);

drop policy if exists "settings editable by admins only" on public.site_settings;
create policy "settings editable by admins only"
  on public.site_settings for update
  using (public.is_admin());

-- =====================================================================
-- Done. If you're setting this project up for the first time and hit
-- this same error on other tables, the safer fix is running every file
-- in supabase/migrations/ in order (0001 through the highest number) —
-- this file only patches site_settings specifically.
-- =====================================================================
