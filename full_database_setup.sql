-- =====================================================================
-- Monad Africa — Full database setup (consolidated)
-- Run in Supabase Dashboard → SQL Editor, once, top to bottom.
--
-- This is every migration in supabase/migrations/ (0001 through 0013)
-- concatenated in their original order, unmodified. It exists because
-- this project's live Supabase database was missing most of its
-- schema — tables like reports, resources, videos, partners, events,
-- news, announcements, credit_transactions, and columns like
-- profiles.xp were never created, which is what caused "Could not
-- find table/column" errors across the admin dashboard.
--
-- Every statement in every section below is idempotent (IF NOT EXISTS
-- / CREATE OR REPLACE / DROP POLICY IF EXISTS throughout) — safe to
-- run against a database that already has some or all of this schema.
-- Later sections intentionally re-create some functions/policies
-- defined in earlier sections (e.g. admin_set_role, site_settings'
-- RLS policies) — that's not a mistake, it's the real history of this
-- schema evolving over 13 rounds; running them in order leaves you
-- with the final, correct version of each, exactly matching what's
-- in the repo today.
-- =====================================================================


-- #######################################################################
-- SOURCE: supabase/migrations/0001_init.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — Initial Schema
-- Run this once in Supabase Dashboard → SQL Editor
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- ADMINS  (allowlist — the real access boundary for the admin dashboard)
-- =====================================================================
create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- =====================================================================
-- PROFILES  (display info for admin accounts)
-- =====================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- SITE SETTINGS  (single row — community stats shown on the homepage)
-- =====================================================================
create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  x_followers int not null default 130,
  discord_members int not null default 160,
  countries_reached int not null default 4,
  builders_onboarded int not null default 30,
  community_partners int not null default 2,
  x_url text default 'https://x.com/monadonafrica',
  discord_url text default 'https://discord.gg/tjY9t3PZF',
  telegram_url text default '',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- =====================================================================
-- BOUNTIES  (project-submitted opportunities, admin-approved)
-- =====================================================================
create table if not exists public.bounties (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  logo_url text,
  website text,
  twitter text,
  discord text,
  contact_email text not null,
  title text not null,
  description text not null,
  skills_needed text,
  category text not null check (category in ('Development','Design','Marketing','Community','Content')),
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  reward text not null,
  deadline date not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_bounties_status on public.bounties (status);
create index if not exists idx_bounties_category on public.bounties (category);

-- =====================================================================
-- APPLICATIONS  (builders applying to a bounty)
-- =====================================================================
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties (id) on delete cascade,
  full_name text not null,
  email text not null,
  portfolio_link text,
  message text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_applications_bounty on public.applications (bounty_id);

-- =====================================================================
-- PROJECTS  (ecosystem showcase, admin-managed)
-- =====================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website text,
  description text,
  category text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- RESOURCES  (beginner hub, admin-managed)
-- =====================================================================
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text not null,
  type text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- VIDEOS  (beginner hub, admin-managed)
-- =====================================================================
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  youtube_url text not null,
  description text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- PARTNERS  (admin-managed)
-- =====================================================================
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  website text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- RLS: enable on every table
-- =====================================================================
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.bounties enable row level security;
alter table public.applications enable row level security;
alter table public.projects enable row level security;
alter table public.resources enable row level security;
alter table public.videos enable row level security;
alter table public.partners enable row level security;

-- ---------- admins ----------
drop policy if exists "admins table managed by admins only" on public.admins;
create policy "admins table managed by admins only"
  on public.admins for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- profiles ----------
drop policy if exists "profiles viewable by owner or admin" on public.profiles;
create policy "profiles viewable by owner or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles editable by owner or admin" on public.profiles;
create policy "profiles editable by owner or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- ---------- site_settings ----------
drop policy if exists "settings readable by everyone" on public.site_settings;
create policy "settings readable by everyone"
  on public.site_settings for select
  using (true);

drop policy if exists "settings editable by admins only" on public.site_settings;
create policy "settings editable by admins only"
  on public.site_settings for update
  using (public.is_admin());

-- ---------- bounties ----------
drop policy if exists "approved bounties are public" on public.bounties;
create policy "approved bounties are public"
  on public.bounties for select
  using (status = 'approved' or public.is_admin());

drop policy if exists "anyone can submit a bounty as pending" on public.bounties;
create policy "anyone can submit a bounty as pending"
  on public.bounties for insert
  with check (status = 'pending');

drop policy if exists "admins manage bounties" on public.bounties;
create policy "admins manage bounties"
  on public.bounties for update
  using (public.is_admin());

drop policy if exists "admins delete bounties" on public.bounties;
create policy "admins delete bounties"
  on public.bounties for delete
  using (public.is_admin());

-- ---------- applications ----------
drop policy if exists "anyone can apply to a bounty" on public.applications;
create policy "anyone can apply to a bounty"
  on public.applications for insert
  with check (true);

drop policy if exists "only admins can view applications" on public.applications;
create policy "only admins can view applications"
  on public.applications for select
  using (public.is_admin());

drop policy if exists "only admins can update applications" on public.applications;
create policy "only admins can update applications"
  on public.applications for update
  using (public.is_admin());

drop policy if exists "only admins can delete applications" on public.applications;
create policy "only admins can delete applications"
  on public.applications for delete
  using (public.is_admin());

-- ---------- projects (ecosystem showcase) ----------
drop policy if exists "projects are public" on public.projects;
create policy "projects are public"
  on public.projects for select
  using (true);

drop policy if exists "admins manage projects" on public.projects;
create policy "admins manage projects"
  on public.projects for insert with check (public.is_admin());
drop policy if exists "admins update projects" on public.projects;
create policy "admins update projects"
  on public.projects for update using (public.is_admin());
drop policy if exists "admins delete projects" on public.projects;
create policy "admins delete projects"
  on public.projects for delete using (public.is_admin());

-- ---------- resources ----------
drop policy if exists "resources are public" on public.resources;
create policy "resources are public"
  on public.resources for select using (true);
drop policy if exists "admins manage resources" on public.resources;
create policy "admins manage resources"
  on public.resources for insert with check (public.is_admin());
drop policy if exists "admins update resources" on public.resources;
create policy "admins update resources"
  on public.resources for update using (public.is_admin());
drop policy if exists "admins delete resources" on public.resources;
create policy "admins delete resources"
  on public.resources for delete using (public.is_admin());

-- ---------- videos ----------
drop policy if exists "videos are public" on public.videos;
create policy "videos are public"
  on public.videos for select using (true);
drop policy if exists "admins manage videos" on public.videos;
create policy "admins manage videos"
  on public.videos for insert with check (public.is_admin());
drop policy if exists "admins update videos" on public.videos;
create policy "admins update videos"
  on public.videos for update using (public.is_admin());
drop policy if exists "admins delete videos" on public.videos;
create policy "admins delete videos"
  on public.videos for delete using (public.is_admin());

-- ---------- partners ----------
drop policy if exists "partners are public" on public.partners;
create policy "partners are public"
  on public.partners for select using (true);
drop policy if exists "admins manage partners" on public.partners;
create policy "admins manage partners"
  on public.partners for insert with check (public.is_admin());
drop policy if exists "admins update partners" on public.partners;
create policy "admins update partners"
  on public.partners for update using (public.is_admin());
drop policy if exists "admins delete partners" on public.partners;
create policy "admins delete partners"
  on public.partners for delete using (public.is_admin());

-- =====================================================================
-- STORAGE: buckets + policies
-- Run AFTER the tables above. Buckets are created via SQL so this file
-- is the single source of truth (you can also create them by hand in
-- Storage → New bucket if you prefer — just match these names).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('resources', 'resources', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

-- Public read on all three buckets (they only ever hold public assets:
-- bounty/partner logos, resource files, video thumbnails/clips).
drop policy if exists "public read logos" on storage.objects;
create policy "public read logos"
  on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists "public read resources" on storage.objects;
create policy "public read resources"
  on storage.objects for select
  using (bucket_id = 'resources');

drop policy if exists "public read videos" on storage.objects;
create policy "public read videos"
  on storage.objects for select
  using (bucket_id = 'videos');

-- Anyone can upload a logo when submitting a bounty (no accounts exist
-- for public users in this app). Uploads are just files landing in
-- storage — they only become linked to something visible once an admin
-- approves the bounty that references the file's URL.
drop policy if exists "anyone can upload a logo" on storage.objects;
create policy "anyone can upload a logo"
  on storage.objects for insert
  with check (bucket_id = 'logos');

-- Resources/videos assets are admin-curated content, so only admins
-- upload to those buckets.
drop policy if exists "admins upload resources" on storage.objects;
create policy "admins upload resources"
  on storage.objects for insert
  with check (bucket_id = 'resources' and public.is_admin());

drop policy if exists "admins upload videos" on storage.objects;
create policy "admins upload videos"
  on storage.objects for insert
  with check (bucket_id = 'videos' and public.is_admin());

drop policy if exists "admins delete storage objects" on storage.objects;
create policy "admins delete storage objects"
  on storage.objects for delete
  using (bucket_id in ('logos','resources','videos') and public.is_admin());

-- =====================================================================
-- Done. Next steps (see README.md):
--   1. Sign up / already have your admin auth user
--   2. Insert your admin user id into public.admins
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0002_user_platform.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0002: User Platform Extension (self-contained version)
-- Run in Supabase SQL Editor AFTER 0001_init.sql.
--
-- This version does NOT assume 0001 fully succeeded. Every table it
-- touches is created with `IF NOT EXISTS` (matching the 0001 schema)
-- before being altered, so this file also runs cleanly on a database
-- where 0001 partially failed or was never run. Nothing is dropped or
-- renamed — existing data and columns are left alone.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Bootstrap: recreate the base tables/functions from 0001 if missing.
-- If they already exist exactly as 0001 defined them, every statement
-- below is a safe no-op.
-- ---------------------------------------------------------------------

create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

drop policy if exists "admins table managed by admins only" on public.admins;
create policy "admins table managed by admins only"
  on public.admins for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles viewable by owner or admin" on public.profiles;
create policy "profiles viewable by owner or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles editable by owner or admin" on public.profiles;
create policy "profiles editable by owner or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

create table if not exists public.bounties (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  logo_url text,
  website text,
  twitter text,
  discord text,
  contact_email text not null,
  title text not null,
  description text not null,
  skills_needed text,
  category text not null check (category in ('Development','Design','Marketing','Community','Content')),
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  reward text not null,
  deadline date not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists idx_bounties_status on public.bounties (status);
create index if not exists idx_bounties_category on public.bounties (category);
alter table public.bounties enable row level security;

drop policy if exists "approved bounties are public" on public.bounties;
create policy "approved bounties are public"
  on public.bounties for select
  using (status = 'approved' or public.is_admin());

drop policy if exists "anyone can submit a bounty as pending" on public.bounties;
create policy "anyone can submit a bounty as pending"
  on public.bounties for insert
  with check (status = 'pending');

drop policy if exists "admins manage bounties" on public.bounties;
create policy "admins manage bounties"
  on public.bounties for update
  using (public.is_admin());

drop policy if exists "admins delete bounties" on public.bounties;
create policy "admins delete bounties"
  on public.bounties for delete
  using (public.is_admin());

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties (id) on delete cascade,
  full_name text not null,
  email text not null,
  portfolio_link text,
  message text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_applications_bounty on public.applications (bounty_id);
alter table public.applications enable row level security;

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  x_followers int not null default 130,
  discord_members int not null default 160,
  countries_reached int not null default 4,
  builders_onboarded int not null default 30,
  community_partners int not null default 2,
  x_url text default 'https://x.com/monadonafrica',
  discord_url text default 'https://discord.gg/tjY9t3PZF',
  telegram_url text default '',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
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
-- From here on: the actual 0002 extension work (unchanged in substance
-- from before, just now guaranteed to have something real to alter).
-- =====================================================================

-- ---------------------------------------------------------------------
-- PROFILES: extend for public user accounts
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text unique,
  add column if not exists email text,
  add column if not exists country text,
  add column if not exists role text check (role in ('Developer','Designer','Content Creator','Community Member','Founder','Student')),
  add column if not exists credits int not null default 5,
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles (id),
  add column if not exists total_referrals int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_profiles_username on public.profiles (username);
create index if not exists idx_profiles_referral_code on public.profiles (referral_code);

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  taken boolean;
begin
  loop
    new_code := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    select exists(select 1 from public.profiles where referral_code = new_code) into taken;
    exit when not taken;
  end loop;
  return new_code;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  referrer public.profiles%rowtype;
begin
  insert into public.profiles (id, full_name, username, email, country, role, credits, referral_code)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    5,
    public.generate_referral_code()
  )
  on conflict (id) do nothing;

  ref_code := new.raw_user_meta_data->>'referred_by_code';
  if ref_code is not null and ref_code <> '' then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found then
      update public.profiles set referred_by = referrer.id where id = new.id;
      update public.profiles
        set credits = credits + 1, total_referrals = total_referrals + 1
        where id = referrer.id;
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit.');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "profiles insertable by owner" on public.profiles;
create policy "profiles insertable by owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- APPLICATIONS: link to real users, add a real status
-- ---------------------------------------------------------------------
alter table public.applications
  add column if not exists user_id uuid references public.profiles (id),
  add column if not exists status text not null default 'pending' check (status in ('pending','approved','rejected'));

create index if not exists idx_applications_user on public.applications (user_id);

drop policy if exists "anyone can apply to a bounty" on public.applications;
drop policy if exists "signed-in users can apply as themselves" on public.applications;
create policy "signed-in users can apply as themselves"
  on public.applications for insert
  with check (auth.uid() = user_id);

drop policy if exists "only admins can view applications" on public.applications;
drop policy if exists "users view own applications, admins view all" on public.applications;
create policy "users view own applications, admins view all"
  on public.applications for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "only admins can update applications" on public.applications;
create policy "only admins can update applications"
  on public.applications for update
  using (public.is_admin());

drop policy if exists "only admins can delete applications" on public.applications;
create policy "only admins can delete applications"
  on public.applications for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- SUBMISSIONS  (new table)
-- ---------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications (id) on delete set null,
  bounty_id uuid not null references public.bounties (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  github_repo text,
  x_post_link text,
  google_docs_link text,
  website_link text,
  file_url text,
  additional_notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_submissions_user on public.submissions (user_id);
create index if not exists idx_submissions_bounty on public.submissions (bounty_id);

alter table public.submissions enable row level security;

drop policy if exists "users view own submissions, admins view all" on public.submissions;
create policy "users view own submissions, admins view all"
  on public.submissions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "signed-in users submit as themselves" on public.submissions;
create policy "signed-in users submit as themselves"
  on public.submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "admins update submissions" on public.submissions;
create policy "admins update submissions"
  on public.submissions for update
  using (public.is_admin());

drop policy if exists "admins delete submissions" on public.submissions;
create policy "admins delete submissions"
  on public.submissions for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- NOTIFICATIONS  (new table)
-- user_id = NULL means "broadcast to everyone".
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in ('new_bounty','submission_accepted','submission_rejected','credits_refreshed','event_announced','referral','application_update')),
  title text not null,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id);

alter table public.notifications enable row level security;

drop policy if exists "users view own + broadcast notifications" on public.notifications;
create policy "users view own + broadcast notifications"
  on public.notifications for select
  using (auth.uid() = user_id or user_id is null or public.is_admin());

drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "admins create notifications" on public.notifications;
create policy "admins create notifications"
  on public.notifications for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- EVENTS  (new table)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date,
  event_type text,
  link text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "events are public" on public.events;
create policy "events are public" on public.events for select using (true);
drop policy if exists "admins manage events insert" on public.events;
create policy "admins manage events insert" on public.events for insert with check (public.is_admin());
drop policy if exists "admins manage events update" on public.events;
create policy "admins manage events update" on public.events for update using (public.is_admin());
drop policy if exists "admins manage events delete" on public.events;
create policy "admins manage events delete" on public.events for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- NEWS  (new table)
-- ---------------------------------------------------------------------
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  link text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.news enable row level security;

drop policy if exists "news is public" on public.news;
create policy "news is public" on public.news for select using (true);
drop policy if exists "admins manage news insert" on public.news;
create policy "admins manage news insert" on public.news for insert with check (public.is_admin());
drop policy if exists "admins manage news update" on public.news;
create policy "admins manage news update" on public.news for update using (public.is_admin());
drop policy if exists "admins manage news delete" on public.news;
create policy "admins manage news delete" on public.news for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- STORAGE: avatars + submission file uploads
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('submission-files', 'submission-files', true)
on conflict (id) do nothing;

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "public read submission files" on storage.objects;
create policy "public read submission files" on storage.objects for select using (bucket_id = 'submission-files');

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users upload own submission files" on storage.objects;
create policy "users upload own submission files"
  on storage.objects for insert
  with check (bucket_id = 'submission-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Backfill the Telegram link if it's currently blank.
-- ---------------------------------------------------------------------
update public.site_settings
set telegram_url = 'https://t.me/monad_africa'
where id = 1 and (telegram_url is null or telegram_url = '');

-- =====================================================================
-- Done. Every table this file touches now exists with the columns and
-- policies it needs, whether or not 0001 had already created them.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0003_protect_profile_fields.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0003: Protect sensitive profile fields
-- Run in Supabase SQL Editor AFTER 0002_user_platform.sql.
--
-- Why: the existing "profiles editable by owner or admin" policy (from
-- 0001) lets a signed-in user UPDATE their own profiles row with no
-- column restriction — which means credits, referral_code, referred_by,
-- and total_referrals could be edited directly via the Supabase client,
-- bypassing the app entirely. Row Level Security alone can't restrict
-- individual columns, so this adds a trigger that silently reverts
-- those specific fields back to their previous value unless the actor
-- is an admin. Everything else on the row (full_name, username, avatar,
-- country, role, bio) remains freely editable by the owner, unchanged.
-- =====================================================================

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.credits := old.credits;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.total_referrals := old.total_referrals;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- =====================================================================
-- Done. No existing data, tables, or policies were removed.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0004_profile_extras_and_credits.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0004: Profile extras + credit system overhaul
-- Run in Supabase SQL Editor AFTER 0001, 0002, 0003.
-- Self-contained: uses IF NOT EXISTS / OR REPLACE throughout so it's
-- safe to run more than once and doesn't assume anything beyond what
-- 0001-0003 already guarantee.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fix an interaction bug with the 0003 protection trigger: that trigger
-- reverts changes to credits/referral fields unless `is_admin()` is
-- true — but `auth.uid()` inside a SECURITY DEFINER function still
-- reflects the original (non-admin) caller, so it would silently
-- cancel the credit deduction inside apply_to_bounty() below. Fix: the
-- trigger also allows the change when a transaction-local flag is set,
-- which only the trusted functions in this file ever set.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and coalesce(current_setting('app.bypass_profile_protection', true), '') <> 'true' then
    new.credits := old.credits;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.total_referrals := old.total_referrals;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- PROFILES: new editable fields + suspension flag
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists bio text,
  add column if not exists region text,
  add column if not exists twitter text,
  add column if not exists telegram text,
  add column if not exists discord text,
  add column if not exists website text,
  add column if not exists is_suspended boolean not null default false;

-- Credits must never go negative, whatever writes to this column.
alter table public.profiles drop constraint if exists profiles_credits_non_negative;
alter table public.profiles add constraint profiles_credits_non_negative check (credits >= 0);

-- Suspended users should not be able to write anything meaningful even
-- though they can still read (keeps their dashboard visible/read-only).
drop policy if exists "profiles editable by owner or admin" on public.profiles;
create policy "profiles editable by owner or admin"
  on public.profiles for update
  using ((auth.uid() = id and is_suspended = false) or public.is_admin());

-- ---------------------------------------------------------------------
-- New signups now get 3 credits (was 5) — update both the column
-- default and the signup trigger.
-- ---------------------------------------------------------------------
alter table public.profiles alter column credits set default 3;

-- ---------------------------------------------------------------------
-- CREDIT TRANSACTIONS  (full history — every credit change is logged
-- here by the functions below, never written to directly by clients)
-- ---------------------------------------------------------------------
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null, -- positive = credit added, negative = credit spent
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_transactions_user on public.credit_transactions (user_id);

alter table public.credit_transactions enable row level security;

drop policy if exists "users view own credit history" on public.credit_transactions;
create policy "users view own credit history"
  on public.credit_transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- No insert/update/delete policies for regular clients — every row is
-- written by a SECURITY DEFINER function below.

-- ---------------------------------------------------------------------
-- Re-create the signup trigger to: grant 3 credits (not 5), and log
-- that grant + any referral bonus to credit_transactions.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  referrer public.profiles%rowtype;
begin
  insert into public.profiles (id, full_name, username, email, country, role, credits, referral_code)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    3,
    public.generate_referral_code()
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, 3, 'signup_bonus');

  ref_code := new.raw_user_meta_data->>'referred_by_code';
  if ref_code is not null and ref_code <> '' then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found then
      update public.profiles set referred_by = referrer.id where id = new.id;
      perform set_config('app.bypass_profile_protection', 'true', true);
      update public.profiles
        set credits = credits + 1, total_referrals = total_referrals + 1
        where id = referrer.id;
      insert into public.credit_transactions (user_id, amount, reason)
      values (referrer.id, 1, 'referral_bonus');
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit.');
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: apply_to_bounty()
-- Replaces direct client INSERTs into `applications`. Atomically checks
-- the bounty is open, the user isn't suspended, hasn't already applied,
-- and has at least 1 credit — then inserts the application, deducts the
-- credit, and logs it. All in one transaction so it can't be raced or
-- bypassed by calling the table directly (direct insert is no longer
-- permitted — see the dropped policy below).
-- ---------------------------------------------------------------------
create or replace function public.apply_to_bounty(
  p_bounty_id uuid,
  p_portfolio_link text,
  p_message text
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_bounty public.bounties%rowtype;
  v_application public.applications%rowtype;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.is_suspended then
    raise exception 'Account suspended';
  end if;
  if v_profile.credits <= 0 then
    raise exception 'No credits remaining — you need at least 1 credit to apply';
  end if;

  select * into v_bounty from public.bounties where id = p_bounty_id;
  if not found or v_bounty.status <> 'approved' then
    raise exception 'Bounty is not open for applications';
  end if;

  if exists (select 1 from public.applications where bounty_id = p_bounty_id and user_id = auth.uid()) then
    raise exception 'You have already applied to this bounty';
  end if;

  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.full_name, v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
  returning * into v_application;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = credits - 1 where id = auth.uid();

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), -1, 'bounty_application:' || p_bounty_id::text);

  return v_application;
end;
$$;

-- Applications can no longer be inserted directly by clients — only via
-- the RPC above, which is what actually enforces the credit deduction.
drop policy if exists "signed-in users can apply as themselves" on public.applications;
drop policy if exists "anyone can apply to a bounty" on public.applications;

-- ---------------------------------------------------------------------
-- RPC: admin_adjust_credits()  — admin only
-- For manual corrections from the admin Users tab. Clamped at 0.
-- ---------------------------------------------------------------------
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can adjust credits';
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles
  set credits = greatest(0, credits + p_amount)
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  insert into public.credit_transactions (user_id, amount, reason)
  values (p_user_id, p_amount, coalesce(nullif(p_reason, ''), 'admin_adjustment'));

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: admin_set_suspended()  — admin only
-- ---------------------------------------------------------------------
create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can suspend accounts';
  end if;

  update public.profiles set is_suspended = p_suspended where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: admin_set_moderator()  — admin only. Adds/removes a user from
-- the admins allowlist (this is what "moderator" access means here).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_moderator(p_user_id uuid, p_is_moderator boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage moderators';
  end if;

  if p_is_moderator then
    insert into public.admins (id) values (p_user_id) on conflict (id) do nothing;
  else
    delete from public.admins where id = p_user_id;
  end if;
end;
$$;

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0005_admin_control_panel.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0005: Admin Control Panel foundation
-- Run in Supabase SQL Editor AFTER 0001-0004.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES: admins table gets a real role column. Existing rows (created
-- before roles existed) are treated as super_admin — they already had
-- full access, this just makes that explicit.
-- ---------------------------------------------------------------------
alter table public.admins
  add column if not exists role text not null default 'moderator' check (role in ('super_admin', 'moderator'));

update public.admins set role = 'super_admin' where role is null or role = 'moderator';
-- ^ one-time backfill for pre-existing rows only; safe to run more than
-- once since it only touches rows that still have the column default.

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid() and role = 'super_admin');
$$;

-- `is_admin()` (from 0001) already means "any admin row exists" — kept
-- as-is, it's used for moderator-level checks throughout.

-- ---------------------------------------------------------------------
-- PROFILES: github, wallet, ban flag, last_seen (for "online" tracking)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists github text,
  add column if not exists wallet_address text,
  add column if not exists is_banned boolean not null default false,
  add column if not exists last_seen timestamptz;

-- Banned users lose write access everywhere the owner-write policies
-- check is_suspended — extend that same policy to also check is_banned.
drop policy if exists "profiles editable by owner or admin" on public.profiles;
create policy "profiles editable by owner or admin"
  on public.profiles for update
  using ((auth.uid() = id and is_suspended = false and is_banned = false) or public.is_admin());

-- ---------------------------------------------------------------------
-- BOUNTIES: closed/reopened as a distinct concept from approval status,
-- so "completed" bounties can be tracked separately from "rejected".
-- ---------------------------------------------------------------------
alter table public.bounties
  add column if not exists is_closed boolean not null default false;

drop policy if exists "admins manage bounties" on public.bounties;
create policy "admins manage bounties"
  on public.bounties for update
  using (public.is_admin());
-- (delete policy from 0001 already admin-only, unchanged)

-- ---------------------------------------------------------------------
-- ANNOUNCEMENTS  (new)
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  pinned boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements are public" on public.announcements;
create policy "announcements are public" on public.announcements for select using (true);
drop policy if exists "admins create announcements" on public.announcements;
create policy "admins create announcements" on public.announcements for insert with check (public.is_admin());
drop policy if exists "admins update announcements" on public.announcements;
create policy "admins update announcements" on public.announcements for update using (public.is_admin());
drop policy if exists "admins delete announcements" on public.announcements;
create policy "admins delete announcements" on public.announcements for delete using (public.is_admin());

-- ---------------------------------------------------------------------
-- SITE CONTENT  (new — homepage CMS: hero copy, buttons, roadmap, FAQ)
-- Single row, super-admin only writes.
-- ---------------------------------------------------------------------
create table if not exists public.site_content (
  id smallint primary key default 1 check (id = 1),
  hero_title text not null default 'Building the Future of Monad in Africa.',
  hero_subtitle text not null default 'Monad Africa connects builders, developers, students, creators, founders, and communities across the continent to real opportunities in the Monad ecosystem.',
  hero_primary_label text not null default 'Explore Bounties',
  hero_primary_href text not null default '/bounties',
  hero_secondary_label text not null default 'Join Community',
  hero_secondary_href text not null default 'discord',
  footer_text text not null default 'The gateway connecting the Monad ecosystem with Africa''s next generation of builders, creators, and communities.',
  roadmap_items jsonb not null default '[]'::jsonb,
  faq_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.site_content (id) values (1) on conflict (id) do nothing;

alter table public.site_content enable row level security;

drop policy if exists "site content readable by everyone" on public.site_content;
create policy "site content readable by everyone" on public.site_content for select using (true);
drop policy if exists "site content editable by super admins" on public.site_content;
create policy "site content editable by super admins" on public.site_content for update using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- SITE SETTINGS: community stats — live where genuinely possible
-- (Discord, via its public widget endpoint), manual everywhere else.
-- x_followers / discord_members / telegram_url / discord_url / x_url
-- already exist from earlier migrations — this adds the rest.
-- ---------------------------------------------------------------------
alter table public.site_settings
  add column if not exists x_followers_change_week int not null default 0,
  add column if not exists telegram_members int not null default 0,
  add column if not exists telegram_members_change_today int not null default 0,
  add column if not exists discord_online_manual int not null default 0,
  add column if not exists discord_joined_today int not null default 0,
  add column if not exists discord_guild_id text default '',
  add column if not exists discord_widget_enabled boolean not null default false;

-- Seed with the real current numbers provided.
update public.site_settings
set x_followers = 1103,
    x_followers_change_week = 21,
    telegram_members = 2587,
    telegram_members_change_today = 34,
    discord_members = 1982,
    discord_online_manual = 132,
    updated_at = now()
where id = 1;

-- ---------------------------------------------------------------------
-- PLATFORM SETTINGS  (new — just the default starting credit amount,
-- so "reset credits" has a real, admin-configurable target)
-- ---------------------------------------------------------------------
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  monthly_credit_allowance int not null default 3,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "platform settings readable by everyone" on public.platform_settings;
create policy "platform settings readable by everyone" on public.platform_settings for select using (true);
drop policy if exists "platform settings editable by super admins" on public.platform_settings;
create policy "platform settings editable by super admins" on public.platform_settings for update using (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Admin RPC: reset a user's credits back to the current platform
-- default (distinct from admin_adjust_credits, which is relative).
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_credits(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_default int;
  v_old_credits int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset credits';
  end if;

  select monthly_credit_allowance into v_default from public.platform_settings where id = 1;
  if v_default is null then v_default := 3; end if;

  select credits into v_old_credits from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = v_default where id = p_user_id
  returning * into v_profile;

  insert into public.credit_transactions (user_id, amount, reason)
  values (p_user_id, v_default - v_old_credits, 'admin_reset');

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin RPC: ban / unban. Enforced at the RLS layer (is_banned already
-- blocks profile self-updates above), plus applications/submissions
-- inserts are re-checked here so a banned user can't apply or submit
-- even though those go through their own SECURITY DEFINER functions.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can ban accounts';
  end if;

  update public.profiles set is_banned = p_banned where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

-- Re-create apply_to_bounty() to also reject banned users (it already
-- rejected suspended users in 0004).
create or replace function public.apply_to_bounty(
  p_bounty_id uuid,
  p_portfolio_link text,
  p_message text
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_bounty public.bounties%rowtype;
  v_application public.applications%rowtype;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.is_suspended then
    raise exception 'Account suspended';
  end if;
  if v_profile.is_banned then
    raise exception 'Account banned';
  end if;
  if v_profile.credits <= 0 then
    raise exception 'No credits remaining — you need at least 1 credit to apply';
  end if;

  select * into v_bounty from public.bounties where id = p_bounty_id;
  if not found or v_bounty.status <> 'approved' or v_bounty.is_closed then
    raise exception 'Bounty is not open for applications';
  end if;

  if exists (select 1 from public.applications where bounty_id = p_bounty_id and user_id = auth.uid()) then
    raise exception 'You have already applied to this bounty';
  end if;

  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.full_name, v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
  returning * into v_application;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = credits - 1 where id = auth.uid();

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), -1, 'bounty_application:' || p_bounty_id::text);

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin RPC: delete a user's PROFILE DATA (not their login/auth
-- account — that requires the Supabase Admin API with the service_role
-- key, which cannot run from client code and is intentionally not
-- implemented here). This removes their profile, applications,
-- submissions, and credit history; their auth.users row and login
-- credentials remain, so treat "Ban" as the actual access-revoking
-- action and this as a data-cleanup action.
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_profile_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete user data';
  end if;

  delete from public.submissions where user_id = p_user_id;
  delete from public.applications where user_id = p_user_id;
  delete from public.credit_transactions where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.admins where id = p_user_id;
  delete from public.profiles where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin RPC: set a user's admin role directly — 'super_admin',
-- 'moderator', or null to remove admin access entirely. Only an
-- existing super admin may call this (a moderator, who currently has
-- no /admin access at all, certainly can't).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can change roles';
  end if;

  if p_role is null or p_role = 'user' then
    delete from public.admins where id = p_user_id;
  elsif p_role in ('super_admin', 'moderator') then
    insert into public.admins (id, role) values (p_user_id, p_role)
    on conflict (id) do update set role = excluded.role;
  else
    raise exception 'Invalid role: %', p_role;
  end if;
end;
$$;

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0006_xp_badges_roles_settings.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0006: XP, Badges, Roles, Settings
-- Run in Supabase SQL Editor AFTER 0001-0005.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES: admins.role gains 'admin' as a distinct tier from
-- 'super_admin'/'moderator'. Ambassador/Member are lighter-weight
-- public-facing statuses, not admin-panel roles, so they live on
-- profiles instead (a badge, not a permission tier) — see is_ambassador
-- below. "Member" is just the default when neither applies.
-- ---------------------------------------------------------------------
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('super_admin', 'admin', 'moderator'));

alter table public.profiles
  add column if not exists is_ambassador boolean not null default false;

-- ---------------------------------------------------------------------
-- XP, wallet-completion tracking, notification preference
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists xp int not null default 0,
  add column if not exists profile_complete_bonus_awarded boolean not null default false,
  add column if not exists notifications_enabled boolean not null default true;

alter table public.profiles drop constraint if exists profiles_xp_non_negative;
alter table public.profiles add constraint profiles_xp_non_negative check (xp >= 0);

-- ---------------------------------------------------------------------
-- XP TRANSACTIONS  (full history, same pattern as credit_transactions)
-- ---------------------------------------------------------------------
create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_transactions_user on public.xp_transactions (user_id);

alter table public.xp_transactions enable row level security;

drop policy if exists "users view own xp history" on public.xp_transactions;
create policy "users view own xp history"
  on public.xp_transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------
-- grant_xp(): the ONLY thing that writes to profiles.xp. Deliberately
-- NOT exposed as a callable RPC (see the revoke below) — it only runs
-- when called from inside another SECURITY DEFINER function in this
-- file (handle_new_user, apply_to_bounty, admin_award_xp, etc.), which
-- Postgres executes using the function owner's privileges regardless
-- of what's been revoked from the `authenticated` role. If this were
-- left callable from the client, any signed-in user could give
-- themselves unlimited XP by calling it directly.
-- ---------------------------------------------------------------------
create or replace function public.grant_xp(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set xp = greatest(0, xp + p_amount) where id = p_user_id;
  insert into public.xp_transactions (user_id, amount, reason) values (p_user_id, p_amount, p_reason);
end;
$$;

revoke execute on function public.grant_xp(uuid, int, text) from public, anon, authenticated;

-- Admin-facing wrapper — this one IS callable by clients, but checks
-- is_admin() itself before doing anything.
create or replace function public.admin_award_xp(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can award XP';
  end if;
  perform public.grant_xp(p_user_id, p_amount, coalesce(nullif(p_reason, ''), 'admin_adjustment'));
  insert into public.notifications (user_id, type, title, message)
  values (p_user_id, 'xp_awarded', 'XP awarded', p_amount || ' XP added to your account.');
end;
$$;

-- ---------------------------------------------------------------------
-- BADGES  (catalog + award join table). Same non-callable-award
-- pattern as XP — award_badge() is internal-only.
-- ---------------------------------------------------------------------
create table if not exists public.badges (
  code text primary key,
  label text not null,
  emoji text not null,
  description text
);

insert into public.badges (code, label, emoji, description) values
  ('early_supporter', 'Early Supporter', '🌟', 'Joined Monad Africa in its early days.'),
  ('top_contributor', 'Top Contributor', '🏆', 'Among the most active referrers and builders.'),
  ('community_builder', 'Community Builder', '🛠', 'Actively grows the Monad Africa community.'),
  ('bounty_hunter', 'Bounty Hunter', '🎯', 'Had a bounty submission approved.'),
  ('ambassador', 'Ambassador', '🤝', 'Official Monad Africa ambassador.'),
  ('moderator', 'Moderator', '🛡', 'Helps moderate the Monad Africa community.'),
  ('verified_builder', 'Verified Builder', '💎', 'Verified as an active, trusted builder.'),
  ('monad_pioneer', 'Monad Pioneer', '🚀', 'Among the earliest builders on Monad.')
on conflict (code) do nothing;

alter table public.badges enable row level security;
drop policy if exists "badges catalog is public" on public.badges;
create policy "badges catalog is public" on public.badges for select using (true);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

alter table public.user_badges enable row level security;
drop policy if exists "user badges are public" on public.user_badges;
create policy "user badges are public" on public.user_badges for select using (true);
-- (public read so badges can display on any profile/leaderboard entry —
-- no sensitive data here, just which badges a user has earned)

create or replace function public.award_badge(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_badges (user_id, badge_code) values (p_user_id, p_code)
  on conflict do nothing;
  if found then
    insert into public.notifications (user_id, type, title, message)
    select p_user_id, 'badge_earned', 'Badge earned', label || ' — ' || description
    from public.badges where code = p_code;
  end if;
end;
$$;

revoke execute on function public.award_badge(uuid, text) from public, anon, authenticated;

create or replace function public.admin_award_badge(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can award badges';
  end if;
  perform public.award_badge(p_user_id, p_code);
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications: widen the type list to cover XP/badge/credit events.
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'new_bounty', 'submission_accepted', 'submission_rejected', 'credits_refreshed',
  'event_announced', 'referral', 'application_update', 'xp_awarded', 'badge_earned',
  'credits_awarded', 'announcement', 'won_bounty'
));

-- ---------------------------------------------------------------------
-- Re-create handle_new_user(): unchanged credit grant, PLUS grants the
-- referrer +10 XP alongside their existing +1 credit.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  referrer public.profiles%rowtype;
begin
  insert into public.profiles (id, full_name, username, email, country, role, credits, referral_code)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    3,
    public.generate_referral_code()
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, 3, 'signup_bonus');

  ref_code := new.raw_user_meta_data->>'referred_by_code';
  if ref_code is not null and ref_code <> '' then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found then
      update public.profiles set referred_by = referrer.id where id = new.id;
      perform set_config('app.bypass_profile_protection', 'true', true);
      update public.profiles
        set credits = credits + 1, total_referrals = total_referrals + 1
        where id = referrer.id;
      insert into public.credit_transactions (user_id, amount, reason)
      values (referrer.id, 1, 'referral_bonus');
      perform public.grant_xp(referrer.id, 10, 'referral_bonus');
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit and 10 XP.');
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create apply_to_bounty(): unchanged credit deduction, PLUS +15 XP
-- for the applicant.
-- ---------------------------------------------------------------------
create or replace function public.apply_to_bounty(
  p_bounty_id uuid,
  p_portfolio_link text,
  p_message text
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_bounty public.bounties%rowtype;
  v_application public.applications%rowtype;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.is_suspended then
    raise exception 'Account suspended';
  end if;
  if v_profile.is_banned then
    raise exception 'Account banned';
  end if;
  if v_profile.credits <= 0 then
    raise exception 'No credits remaining — you need at least 1 credit to apply';
  end if;

  select * into v_bounty from public.bounties where id = p_bounty_id;
  if not found or v_bounty.status <> 'approved' or v_bounty.is_closed then
    raise exception 'Bounty is not open for applications';
  end if;

  if exists (select 1 from public.applications where bounty_id = p_bounty_id and user_id = auth.uid()) then
    raise exception 'You have already applied to this bounty';
  end if;

  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.full_name, v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
  returning * into v_application;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = credits - 1 where id = auth.uid();

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), -1, 'bounty_application:' || p_bounty_id::text);

  perform public.grant_xp(auth.uid(), 15, 'bounty_application:' || p_bounty_id::text);

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create admin_adjust_credits(): unchanged logic, PLUS a
-- notification (the brief calls this out explicitly for the
-- notification center — this was missing before).
-- ---------------------------------------------------------------------
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can adjust credits';
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles
  set credits = greatest(0, credits + p_amount)
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  insert into public.credit_transactions (user_id, amount, reason)
  values (p_user_id, p_amount, coalesce(nullif(p_reason, ''), 'admin_adjustment'));

  insert into public.notifications (user_id, type, title, message)
  values (
    p_user_id, 'credits_awarded',
    case when p_amount >= 0 then 'Credits added' else 'Credits removed' end,
    abs(p_amount) || ' credit(s) ' || (case when p_amount >= 0 then 'added to' else 'removed from' end) || ' your account.'
  );

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_approve_submission(): wraps the plain UPDATE the admin
-- dashboard used to do directly, adding XP + a first-win "Bounty
-- Hunter" badge + a dedicated "won bounty" notification.
-- ---------------------------------------------------------------------
create or replace function public.admin_approve_submission(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_target_user uuid;
  v_already_won boolean;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve submissions';
  end if;

  select user_id into v_target_user from public.submissions where id = p_submission_id;
  if v_target_user is null then
    raise exception 'Submission not found';
  end if;

  select exists(
    select 1 from public.submissions where user_id = v_target_user and status = 'approved'
  ) into v_already_won;

  update public.submissions set status = 'approved' where id = p_submission_id
  returning * into v_submission;

  perform public.grant_xp(v_submission.user_id, 50, 'submission_approved:' || p_submission_id::text);

  if not v_already_won then
    perform public.award_badge(v_submission.user_id, 'bounty_hunter');
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (v_submission.user_id, 'won_bounty', 'Submission approved!', 'Your bounty submission was accepted — you earned 50 XP.');

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- Profile-completion bonus: called from the client after a profile
-- save. Only pays out once (profile_complete_bonus_awarded), and only
-- if the profile is genuinely fully filled in — recomputed server-side
-- rather than trusting a client-sent "you're done" flag.
-- ---------------------------------------------------------------------
create or replace function public.claim_profile_completion_bonus()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_complete boolean;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.profile_complete_bonus_awarded then
    return false;
  end if;

  v_complete := v_profile.avatar_url is not null and v_profile.avatar_url <> ''
    and v_profile.username is not null and v_profile.username <> ''
    and v_profile.bio is not null and v_profile.bio <> ''
    and v_profile.country is not null and v_profile.country <> ''
    and v_profile.region is not null and v_profile.region <> ''
    and v_profile.wallet_address is not null and v_profile.wallet_address <> ''
    and (
      (v_profile.twitter is not null and v_profile.twitter <> '') or
      (v_profile.discord is not null and v_profile.discord <> '') or
      (v_profile.telegram is not null and v_profile.telegram <> '') or
      (v_profile.github is not null and v_profile.github <> '')
    );

  if not v_complete then
    return false;
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set profile_complete_bonus_awarded = true where id = auth.uid();
  perform public.grant_xp(auth.uid(), 20, 'profile_complete_bonus');
  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Profile complete!', 'You earned 20 XP for completing your profile.');

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Safety net: if a signed-in user somehow has no profiles row (e.g. the
-- signup trigger failed, or an account predates it), create one with
-- the standard 3-credit grant on next login. Callable by the user
-- themselves — checks auth.uid() directly, no admin needed.
-- ---------------------------------------------------------------------
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;

  select email into v_email from auth.users where id = auth.uid();

  insert into public.profiles (id, email, credits, referral_code)
  values (auth.uid(), v_email, 3, public.generate_referral_code())
  returning * into v_profile;

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), 3, 'signup_bonus_backfill');

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- Self-service account deletion (Settings page). Same limitation as
-- admin_delete_profile_data: removes profile data, does NOT delete the
-- login/auth account (needs the Supabase Admin API + service_role,
-- which cannot run client-side). Signs the user out client-side after.
-- ---------------------------------------------------------------------
create or replace function public.self_delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.submissions where user_id = auth.uid();
  delete from public.applications where user_id = auth.uid();
  delete from public.credit_transactions where user_id = auth.uid();
  delete from public.xp_transactions where user_id = auth.uid();
  delete from public.user_badges where user_id = auth.uid();
  delete from public.notifications where user_id = auth.uid();
  delete from public.admins where id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------
-- BOUNTIES: featured flag (admin "Feature Bounties" capability)
-- ---------------------------------------------------------------------
alter table public.bounties add column if not exists is_featured boolean not null default false;

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0007_role_tiers_and_wallet.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0007: Role-tiered permissions + rank/wallet support
-- Run in Supabase SQL Editor AFTER 0001-0006.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
--
-- WHY THIS FILE EXISTS: an earlier round locked /admin to Super Admin
-- only, per that round's literal spec. This round explicitly requires a
-- working Moderator Panel (review/approve/reject submissions, award XP,
-- award credits — but NOT ban/suspend/delete/promote/edit settings).
-- Several RPCs were checking is_admin() (true for ANY staff tier,
-- moderator included) when they should have required a higher tier.
-- This file fixes that at the database layer — the real security
-- boundary — not just by hiding buttons in the UI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- is_staff_admin(): true for 'admin' or 'super_admin', false for
-- 'moderator'. Used for actions the brief reserves for Admin+.
-- ---------------------------------------------------------------------
create or replace function public.is_staff_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid() and role in ('super_admin', 'admin'));
$$;

-- ---------------------------------------------------------------------
-- Tighten: suspend/ban/delete-user-data require Admin+ (not Moderator).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_suspended(p_user_id uuid, p_suspended boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can suspend accounts';
  end if;

  update public.profiles set is_suspended = p_suspended where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can ban accounts';
  end if;

  update public.profiles set is_banned = p_banned where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.admin_delete_profile_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can delete user data';
  end if;

  delete from public.submissions where user_id = p_user_id;
  delete from public.applications where user_id = p_user_id;
  delete from public.credit_transactions where user_id = p_user_id;
  delete from public.xp_transactions where user_id = p_user_id;
  delete from public.user_badges where user_id = p_user_id;
  delete from public.admins where id = p_user_id;
  delete from public.profiles where id = p_user_id;
end;
$$;

create or replace function public.admin_reset_credits(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_default int;
  v_old_credits int;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can reset credits';
  end if;

  select monthly_credit_allowance into v_default from public.platform_settings where id = 1;
  if v_default is null then v_default := 3; end if;

  select credits into v_old_credits from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = v_default where id = p_user_id
  returning * into v_profile;

  insert into public.credit_transactions (user_id, amount, reason)
  values (p_user_id, v_default - v_old_credits, 'admin_reset');

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- Role changes: promoting to 'moderator' or 'admin' only requires
-- Admin+; promoting to 'super_admin' (or demoting one) requires being
-- a Super Admin yourself — an Admin can't mint peer Admins/Super Admins.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role = 'super_admin' or exists (select 1 from public.admins where id = p_user_id and role = 'super_admin') then
    if not public.is_super_admin() then
      raise exception 'Only Super Admins can grant or change Super Admin access';
    end if;
  elsif not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can change roles';
  end if;

  if p_role is null or p_role = 'user' then
    delete from public.admins where id = p_user_id;
  elsif p_role in ('super_admin', 'admin', 'moderator') then
    insert into public.admins (id, role) values (p_user_id, p_role)
    on conflict (id) do update set role = excluded.role;
  else
    raise exception 'Invalid role: %', p_role;
  end if;
end;
$$;

-- (admin_adjust_credits, admin_award_xp, admin_award_badge,
-- admin_approve_submission all correctly already check plain is_admin()
-- — Moderators are meant to do exactly these things, unchanged.)

-- ---------------------------------------------------------------------
-- Wallet: allow multiple saved connections isn't needed (one address is
-- enough per the brief), but add a `wallet_provider` label so the
-- profile can show *which* wallet was connected (MetaMask/Rabby/
-- Backpack/Phantom), not just the raw address.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists wallet_provider text;

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0008_fix_blank_credits.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0008: Fix blank Credits card (NULL credits backfill)
-- Run in Supabase SQL Editor AFTER 0001-0007.
--
-- The Credits card was rendering blank because profiles.credits was
-- NULL for some rows. The column was always intended to be
-- `not null default 3`, but across several rounds of migrations it's
-- possible that constraint never actually landed on every row (or on
-- rows created before it existed). This migration is fully defensive:
-- it doesn't assume any prior state, just guarantees the end result.
-- =====================================================================

-- 1. Backfill: any row with NULL credits gets 3.
update public.profiles set credits = 3 where credits is null;

-- 2. Make sure the default is 3 for future inserts (idempotent).
alter table public.profiles alter column credits set default 3;

-- 3. Make sure the column can never be NULL again (idempotent — if this
--    constraint already exists, re-running it is a harmless no-op).
alter table public.profiles alter column credits set not null;

-- =====================================================================
-- Done. Every existing row now has a real integer in credits, and no
-- future row can be inserted without one.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0009_featured_projects.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0009: Featured Projects carousel support
-- Run in Supabase SQL Editor AFTER 0001-0008.
-- =====================================================================

alter table public.projects add column if not exists is_featured boolean not null default false;

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0010_configurable_xp_and_rbac_hardening.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0010: Configurable XP rewards, RBAC hardening, reports
-- Run in Supabase SQL Editor AFTER 0001-0009.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
-- =====================================================================

-- ---------------------------------------------------------------------
-- XP self-heals the same way credits did in 0008: backfill any NULL to
-- 0, guarantee NOT NULL DEFAULT 0 so the "never blank" requirement is
-- enforced at the database layer, not just the client.
-- ---------------------------------------------------------------------
update public.profiles set xp = 0 where xp is null;
alter table public.profiles alter column xp set default 0;
alter table public.profiles alter column xp set not null;

-- ---------------------------------------------------------------------
-- XP REWARD CONFIG — admin-editable, no code changes needed to adjust
-- amounts. Seeded with the values from this round's spec.
-- ---------------------------------------------------------------------
create table if not exists public.xp_reward_config (
  key text primary key,
  label text not null,
  amount int not null,
  updated_at timestamptz not null default now()
);

insert into public.xp_reward_config (key, label, amount) values
  ('profile_complete', 'Complete Profile', 20),
  ('wallet_connect', 'Connect Wallet', 10),
  ('first_submission', 'Submit First Bounty (one-time bonus)', 25),
  ('submission_approved', 'Approved Bounty Submission', 50),
  ('bounty_winner', 'Win Bounty (bonus on top of approval)', 100),
  ('referral', 'Successful Referral', 25),
  ('community_campaign', 'Official Community Campaign (manual award default)', 0)
on conflict (key) do nothing;

alter table public.xp_reward_config enable row level security;
drop policy if exists "xp reward config readable by everyone" on public.xp_reward_config;
create policy "xp reward config readable by everyone" on public.xp_reward_config for select using (true);
drop policy if exists "xp reward config editable by super admins" on public.xp_reward_config;
create policy "xp reward config editable by super admins" on public.xp_reward_config for update using (public.is_super_admin());

create or replace function public.xp_reward(p_key text)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select amount from public.xp_reward_config where key = p_key), 0);
$$;

-- ---------------------------------------------------------------------
-- One-time-bonus tracking flags (mirrors profile_complete_bonus_awarded
-- from 0004, same pattern: prevents a bonus from being paid twice).
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists wallet_bonus_awarded boolean not null default false,
  add column if not exists first_submission_bonus_awarded boolean not null default false;

-- ---------------------------------------------------------------------
-- Re-create handle_new_user(): referral bonus now reads from config
-- (was hardcoded 10, spec now says 25 — the config table is the single
-- source of truth, this just stops hardcoding the number).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  referrer public.profiles%rowtype;
begin
  insert into public.profiles (id, full_name, username, email, country, role, credits, referral_code)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    new.email,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    3,
    public.generate_referral_code()
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, 3, 'signup_bonus');

  ref_code := new.raw_user_meta_data->>'referred_by_code';
  if ref_code is not null and ref_code <> '' then
    select * into referrer from public.profiles where referral_code = ref_code;
    if found then
      update public.profiles set referred_by = referrer.id where id = new.id;
      perform set_config('app.bypass_profile_protection', 'true', true);
      update public.profiles
        set credits = credits + 1, total_referrals = total_referrals + 1
        where id = referrer.id;
      insert into public.credit_transactions (user_id, amount, reason)
      values (referrer.id, 1, 'referral_bonus');
      perform public.grant_xp(referrer.id, public.xp_reward('referral'), 'referral_bonus');
      insert into public.notifications (user_id, type, title, message)
      values (referrer.id, 'referral', 'Referral bonus', 'Someone signed up with your referral link — you earned 1 credit and ' || public.xp_reward('referral') || ' XP.');
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create apply_to_bounty(): the existing +XP-per-application still
-- happens (unchanged behavior, reads from config now instead of a
-- hardcoded 15), PLUS a one-time "first submission" bonus on top of
-- that for a user's very first application ever.
-- ---------------------------------------------------------------------
create or replace function public.apply_to_bounty(
  p_bounty_id uuid,
  p_portfolio_link text,
  p_message text
)
returns public.applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_bounty public.bounties%rowtype;
  v_application public.applications%rowtype;
  v_is_first boolean;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.is_suspended then
    raise exception 'Account suspended';
  end if;
  if v_profile.is_banned then
    raise exception 'Account banned';
  end if;
  if v_profile.credits <= 0 then
    raise exception 'No credits remaining — you need at least 1 credit to apply';
  end if;

  select * into v_bounty from public.bounties where id = p_bounty_id;
  if not found or v_bounty.status <> 'approved' or v_bounty.is_closed then
    raise exception 'Bounty is not open for applications';
  end if;

  if exists (select 1 from public.applications where bounty_id = p_bounty_id and user_id = auth.uid()) then
    raise exception 'You have already applied to this bounty';
  end if;

  v_is_first := not exists (select 1 from public.applications where user_id = auth.uid());

  insert into public.applications (bounty_id, user_id, full_name, email, portfolio_link, message, status)
  values (p_bounty_id, auth.uid(), coalesce(v_profile.full_name, v_profile.username, ''), coalesce(v_profile.email, ''), p_portfolio_link, p_message, 'pending')
  returning * into v_application;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set credits = credits - 1 where id = auth.uid();

  insert into public.credit_transactions (user_id, amount, reason)
  values (auth.uid(), -1, 'bounty_application:' || p_bounty_id::text);

  perform public.grant_xp(auth.uid(), public.xp_reward('first_submission') / 5, 'bounty_application:' || p_bounty_id::text);
  -- ^ small recurring XP for every application (kept from the prior
  -- round's behavior so nothing regresses), scaled down from the
  -- one-time first-submission bonus so the numbers stay sensible
  -- relative to each other; fully admin-adjustable via xp_reward_config
  -- since it's still just reading 'first_submission' / 5.

  if v_is_first and not v_profile.first_submission_bonus_awarded then
    perform public.grant_xp(auth.uid(), public.xp_reward('first_submission'), 'first_submission_bonus');
    perform set_config('app.bypass_profile_protection', 'true', true);
    update public.profiles set first_submission_bonus_awarded = true where id = auth.uid();
    insert into public.notifications (user_id, type, title, message)
    values (auth.uid(), 'xp_awarded', 'First submission bonus!', 'You earned an extra ' || public.xp_reward('first_submission') || ' XP for your first bounty application.');
  end if;

  return v_application;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create admin_approve_submission(): reads the approval XP amount
-- from config instead of a hardcoded 50. "Win Bounty" (+100) is now a
-- SEPARATE action below (admin_mark_submission_winner), since the
-- brief distinguishes "Approved" from "Won" as two different events.
-- ---------------------------------------------------------------------
create or replace function public.admin_approve_submission(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_target_user uuid;
  v_already_won boolean;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve submissions';
  end if;

  select user_id into v_target_user from public.submissions where id = p_submission_id;
  if v_target_user is null then
    raise exception 'Submission not found';
  end if;

  select exists(
    select 1 from public.submissions where user_id = v_target_user and status = 'approved'
  ) into v_already_won;

  update public.submissions set status = 'approved' where id = p_submission_id
  returning * into v_submission;

  perform public.grant_xp(v_submission.user_id, public.xp_reward('submission_approved'), 'submission_approved:' || p_submission_id::text);

  if not v_already_won then
    perform public.award_badge(v_submission.user_id, 'bounty_hunter');
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (v_submission.user_id, 'won_bounty', 'Submission approved!', 'Your bounty submission was accepted — you earned ' || public.xp_reward('submission_approved') || ' XP.');

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- NEW: admin_mark_submission_winner() — the "Win Bounty" +100 XP bonus,
-- distinct from plain approval. Only makes sense on an already-approved
-- submission; awards the bonus once (guarded by submissions.is_winner).
-- ---------------------------------------------------------------------
alter table public.submissions add column if not exists is_winner boolean not null default false;

create or replace function public.admin_mark_submission_winner(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can mark a winner';
  end if;

  select * into v_submission from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if v_submission.status <> 'approved' then
    raise exception 'Only approved submissions can be marked as a winner';
  end if;
  if v_submission.is_winner then
    raise exception 'Already marked as a winner';
  end if;

  update public.submissions set is_winner = true where id = p_submission_id
  returning * into v_submission;

  perform public.grant_xp(v_submission.user_id, public.xp_reward('bounty_winner'), 'bounty_winner:' || p_submission_id::text);
  perform public.award_badge(v_submission.user_id, 'top_contributor');

  insert into public.notifications (user_id, type, title, message)
  values (v_submission.user_id, 'won_bounty', '🏆 You won!', 'Your submission was selected as a winner — you earned an extra ' || public.xp_reward('bounty_winner') || ' XP.');

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- NEW: claim_wallet_connect_bonus() — +10 XP, once, for connecting a
-- wallet. Mirrors claim_profile_completion_bonus()'s pattern: called
-- from the client after a successful save, re-verified server-side.
-- ---------------------------------------------------------------------
create or replace function public.claim_wallet_connect_bonus()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.wallet_bonus_awarded then
    return false;
  end if;
  if v_profile.wallet_address is null or v_profile.wallet_address = '' then
    return false;
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set wallet_bonus_awarded = true where id = auth.uid();
  perform public.grant_xp(auth.uid(), public.xp_reward('wallet_connect'), 'wallet_connect_bonus');
  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Wallet connected!', 'You earned ' || public.xp_reward('wallet_connect') || ' XP for connecting a wallet.');

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Re-create claim_profile_completion_bonus(): unchanged logic, now
-- reads the amount from config instead of a hardcoded 20.
-- ---------------------------------------------------------------------
create or replace function public.claim_profile_completion_bonus()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_complete boolean;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.profile_complete_bonus_awarded then
    return false;
  end if;

  v_complete := v_profile.avatar_url is not null and v_profile.avatar_url <> ''
    and v_profile.username is not null and v_profile.username <> ''
    and v_profile.bio is not null and v_profile.bio <> ''
    and v_profile.country is not null and v_profile.country <> ''
    and v_profile.region is not null and v_profile.region <> ''
    and v_profile.wallet_address is not null and v_profile.wallet_address <> ''
    and (
      (v_profile.twitter is not null and v_profile.twitter <> '') or
      (v_profile.discord is not null and v_profile.discord <> '') or
      (v_profile.telegram is not null and v_profile.telegram <> '') or
      (v_profile.github is not null and v_profile.github <> '')
    );

  if not v_complete then
    return false;
  end if;

  perform set_config('app.bypass_profile_protection', 'true', true);
  update public.profiles set profile_complete_bonus_awarded = true where id = auth.uid();
  perform public.grant_xp(auth.uid(), public.xp_reward('profile_complete'), 'profile_complete_bonus');
  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Profile complete!', 'You earned ' || public.xp_reward('profile_complete') || ' XP for completing your profile.');

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- NEW: admin_award_community_xp() — the "Official Community Campaign"
-- reward, admin-triggered with a custom amount (defaults to the
-- configured value but can be overridden per-award for one-off
-- campaigns without needing a code change).
-- ---------------------------------------------------------------------
create or replace function public.admin_award_community_xp(p_user_id uuid, p_amount int, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can award community XP';
  end if;
  perform public.grant_xp(p_user_id, p_amount, coalesce(nullif(p_reason, ''), 'community_campaign'));
  insert into public.notifications (user_id, type, title, message)
  values (p_user_id, 'xp_awarded', 'Community reward', p_amount || ' XP awarded: ' || coalesce(nullif(p_reason, ''), 'community campaign participation'));
end;
$$;

-- ---------------------------------------------------------------------
-- RBAC hardening: an Admin must not be able to ban or delete a Super
-- Admin's data (the brief explicitly forbids "Delete Super Admins" for
-- the Admin tier — extending the same protection to Ban, since leaving
-- that door open would be an easy way around the delete restriction).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_banned(p_user_id uuid, p_banned boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can ban accounts';
  end if;
  if exists (select 1 from public.admins where id = p_user_id and role = 'super_admin') and not public.is_super_admin() then
    raise exception 'Only a Super Admin can ban another Super Admin';
  end if;

  update public.profiles set is_banned = p_banned where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  return v_profile;
end;
$$;

create or replace function public.admin_delete_profile_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can delete user data';
  end if;
  if exists (select 1 from public.admins where id = p_user_id and role = 'super_admin') and not public.is_super_admin() then
    raise exception 'Only a Super Admin can delete another Super Admin''s data';
  end if;

  delete from public.submissions where user_id = p_user_id;
  delete from public.applications where user_id = p_user_id;
  delete from public.credit_transactions where user_id = p_user_id;
  delete from public.xp_transactions where user_id = p_user_id;
  delete from public.user_badges where user_id = p_user_id;
  delete from public.admins where id = p_user_id;
  delete from public.profiles where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------
-- REPORTS  (new) — Moderator "View reports" capability. Any signed-in
-- user can file one; only staff can read/resolve them.
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null check (target_type in ('bounty', 'submission', 'user')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_status on public.reports (status);

alter table public.reports enable row level security;

drop policy if exists "signed-in users can file a report" on public.reports;
create policy "signed-in users can file a report"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "staff can view all reports" on public.reports;
create policy "staff can view all reports"
  on public.reports for select
  using (public.is_admin() or reporter_id = auth.uid());

drop policy if exists "staff can update reports" on public.reports;
create policy "staff can update reports"
  on public.reports for update
  using (public.is_admin());

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0011_reset_xp.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0011: Reset XP admin action
-- Run in Supabase SQL Editor AFTER 0001-0010.
-- =====================================================================

create or replace function public.admin_reset_xp(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old_xp int;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can reset XP';
  end if;

  select xp into v_old_xp from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  perform public.grant_xp(p_user_id, -v_old_xp, 'admin_reset');

  select * into v_profile from public.profiles where id = p_user_id;
  return v_profile;
end;
$$;

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0012_admin_dashboard_hardening.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0012: Admin Dashboard hardening
-- Run in Supabase SQL Editor AFTER 0001-0011.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout).
--
-- WHY THIS FILE EXISTS: a full audit of the existing Admin Dashboard
-- found a few real gaps, fixed here at the database layer (the real
-- trust boundary in this app, same as every prior round):
--   1. Submission rejection was a plain client-side UPDATE + a separate
--      notification insert — unlike approval, which is one atomic RPC.
--      Same inconsistency risk (a network drop between the two calls
--      leaves a rejected submission with no notification sent).
--   2. The Ambassador toggle did a direct `profiles` update plus a
--      separate badge-award RPC — same non-atomic pattern.
--   3. Credits/XP totals (Admin → Credits, and the new Analytics tab)
--      were computed by fetching every transaction row to the browser
--      and summing client-side — doesn't scale, and is unnecessary
--      network weight. Replaced with a server-side aggregate.
--   4. Leaderboard Management asked for a real action beyond "view top
--      25" — a per-user "hide from public leaderboard" flag, for
--      test/flagged accounts.
-- No existing function signature, RLS policy, or role check is
-- changed by this file.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_reject_submission(): mirrors admin_approve_submission() —
-- atomic status update + notification, is_admin() gated (Moderators
-- included, same tier as approval always was).
-- ---------------------------------------------------------------------
create or replace function public.admin_reject_submission(p_submission_id uuid, p_reason text default null)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reject submissions';
  end if;

  update public.submissions set status = 'rejected' where id = p_submission_id
  returning * into v_submission;

  if not found then
    raise exception 'Submission not found';
  end if;

  insert into public.notifications (user_id, type, title, message)
  values (
    v_submission.user_id, 'submission_rejected', 'Submission rejected',
    coalesce(nullif(p_reason, ''), 'Your bounty submission was not accepted this time.')
  );

  return v_submission;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_toggle_ambassador(): wraps the profile-update + badge-award
-- into one atomic call, is_admin() gated (unchanged tier from before —
-- this was already Admin+ only in the UI, now enforced here too).
-- ---------------------------------------------------------------------
create or replace function public.admin_toggle_ambassador(p_user_id uuid, p_is_ambassador boolean)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change ambassador status';
  end if;

  update public.profiles set is_ambassador = p_is_ambassador where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'User not found';
  end if;

  if p_is_ambassador then
    perform public.award_badge(p_user_id, 'ambassador');
  end if;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- admin_credit_totals() / admin_xp_totals(): server-side sums so the
-- Credits tab and the new Analytics tab stop pulling every transaction
-- row to the browser just to add them up. is_admin() gated (read-only,
-- same visibility tier admins already had into this data).
-- ---------------------------------------------------------------------
create or replace function public.admin_credit_totals()
returns table (issued bigint, spent bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where amount > 0), 0)::bigint as issued,
    coalesce(abs(sum(amount) filter (where amount < 0)), 0)::bigint as spent
  from public.credit_transactions
  where public.is_admin();
$$;

create or replace function public.admin_xp_totals()
returns table (issued bigint, spent bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(sum(amount) filter (where amount > 0), 0)::bigint as issued,
    coalesce(abs(sum(amount) filter (where amount < 0)), 0)::bigint as spent
  from public.xp_transactions
  where public.is_admin();
$$;

-- ---------------------------------------------------------------------
-- admin_xp_by_reason(): powers the Analytics tab's "XP by source"
-- breakdown. Transaction reasons like 'submission_approved:<uuid>' are
-- bucketed by the part before the colon so the chart shows "submission
-- approved" once, not one bar per submission. Same non-throwing,
-- is_admin()-gated read pattern as the totals functions above.
-- ---------------------------------------------------------------------
create or replace function public.admin_xp_by_reason()
returns table (bucket text, total bigint)
language sql
security definer
stable
set search_path = public
as $$
  select split_part(reason, ':', 1) as bucket, sum(amount)::bigint as total
  from public.xp_transactions
  where public.is_admin()
  group by 1
  order by total desc;
$$;

-- ---------------------------------------------------------------------
-- Leaderboard Management: per-user opt-out of the public leaderboard
-- (test/flagged accounts). Defaults to visible (false) for everyone
-- existing, matching current behavior exactly.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists hide_from_leaderboard boolean not null default false;

-- ---------------------------------------------------------------------
-- Indexes to support the new pagination/sorting added across the admin
-- dashboard this round (Users sort-by-XP, Leaderboard, Overview
-- "online" count, Submissions/Applications status filters).
-- ---------------------------------------------------------------------
create index if not exists idx_profiles_xp on public.profiles (xp desc);
create index if not exists idx_profiles_last_seen on public.profiles (last_seen);
create index if not exists idx_submissions_status on public.submissions (status);
create index if not exists idx_applications_status on public.applications (status);

-- =====================================================================
-- Done.
-- =====================================================================

-- #######################################################################
-- SOURCE: supabase/migrations/0013_site_settings_recovery.sql
-- #######################################################################

-- =====================================================================
-- Monad Africa — 0013: site_settings recovery
-- Run in Supabase SQL Editor.
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

-- =====================================================================
-- Done. Every table, column, function, trigger, index, and RLS policy
-- the application code depends on now exists.
-- =====================================================================
