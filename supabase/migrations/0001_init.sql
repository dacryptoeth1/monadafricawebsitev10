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
  discord_url text default 'https://discord.gg/9Fj5KtQCS',
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
create policy "admins table managed by admins only"
  on public.admins for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- profiles ----------
create policy "profiles viewable by owner or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles editable by owner or admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- ---------- site_settings ----------
create policy "settings readable by everyone"
  on public.site_settings for select
  using (true);

create policy "settings editable by admins only"
  on public.site_settings for update
  using (public.is_admin());

-- ---------- bounties ----------
create policy "approved bounties are public"
  on public.bounties for select
  using (status = 'approved' or public.is_admin());

create policy "anyone can submit a bounty as pending"
  on public.bounties for insert
  with check (status = 'pending');

create policy "admins manage bounties"
  on public.bounties for update
  using (public.is_admin());

create policy "admins delete bounties"
  on public.bounties for delete
  using (public.is_admin());

-- ---------- applications ----------
create policy "anyone can apply to a bounty"
  on public.applications for insert
  with check (true);

create policy "only admins can view applications"
  on public.applications for select
  using (public.is_admin());

create policy "only admins can update applications"
  on public.applications for update
  using (public.is_admin());

create policy "only admins can delete applications"
  on public.applications for delete
  using (public.is_admin());

-- ---------- projects (ecosystem showcase) ----------
create policy "projects are public"
  on public.projects for select
  using (true);

create policy "admins manage projects"
  on public.projects for insert with check (public.is_admin());
create policy "admins update projects"
  on public.projects for update using (public.is_admin());
create policy "admins delete projects"
  on public.projects for delete using (public.is_admin());

-- ---------- resources ----------
create policy "resources are public"
  on public.resources for select using (true);
create policy "admins manage resources"
  on public.resources for insert with check (public.is_admin());
create policy "admins update resources"
  on public.resources for update using (public.is_admin());
create policy "admins delete resources"
  on public.resources for delete using (public.is_admin());

-- ---------- videos ----------
create policy "videos are public"
  on public.videos for select using (true);
create policy "admins manage videos"
  on public.videos for insert with check (public.is_admin());
create policy "admins update videos"
  on public.videos for update using (public.is_admin());
create policy "admins delete videos"
  on public.videos for delete using (public.is_admin());

-- ---------- partners ----------
create policy "partners are public"
  on public.partners for select using (true);
create policy "admins manage partners"
  on public.partners for insert with check (public.is_admin());
create policy "admins update partners"
  on public.partners for update using (public.is_admin());
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
create policy "public read logos"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "public read resources"
  on storage.objects for select
  using (bucket_id = 'resources');

create policy "public read videos"
  on storage.objects for select
  using (bucket_id = 'videos');

-- Anyone can upload a logo when submitting a bounty (no accounts exist
-- for public users in this app). Uploads are just files landing in
-- storage — they only become linked to something visible once an admin
-- approves the bounty that references the file's URL.
create policy "anyone can upload a logo"
  on storage.objects for insert
  with check (bucket_id = 'logos');

-- Resources/videos assets are admin-curated content, so only admins
-- upload to those buckets.
create policy "admins upload resources"
  on storage.objects for insert
  with check (bucket_id = 'resources' and public.is_admin());

create policy "admins upload videos"
  on storage.objects for insert
  with check (bucket_id = 'videos' and public.is_admin());

create policy "admins delete storage objects"
  on storage.objects for delete
  using (bucket_id in ('logos','resources','videos') and public.is_admin());

-- =====================================================================
-- Done. Next steps (see README.md):
--   1. Sign up / already have your admin auth user
--   2. Insert your admin user id into public.admins
-- =====================================================================
