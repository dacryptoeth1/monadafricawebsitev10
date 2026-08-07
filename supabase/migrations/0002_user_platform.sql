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
