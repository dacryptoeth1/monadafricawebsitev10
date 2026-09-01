-- =====================================================================
-- Monad Africa — 0035: Official Team page + Partnership submissions
-- Run in Supabase SQL Editor AFTER 0001-0034.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout, safe to re-run).
-- =====================================================================

-- ---------------------------------------------------------------------
-- TEAM MEMBERS — the official, admin-curated Monad Africa team shown on
-- the public /team page. Deliberately a separate table from
-- `public.profiles` (normal user accounts): a community member picking
-- a "Founder" role on their own profile must never make them show up as
-- an official team member — only a row an admin creates here does that.
-- Only active rows are public; admins can see/manage everything.
-- ---------------------------------------------------------------------
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- The single title shown most prominently on the card, e.g.
  -- "Co-founder & Lead Business Development".
  primary_role text not null,
  -- Secondary role chips shown alongside the primary title, e.g.
  -- {"Partnerships"} — kept separate from primary_role so the UI can
  -- style the main title differently from the extra badges.
  badges text[] not null default '{}',
  avatar_url text,
  x_url text,
  telegram_url text,
  bio text,
  -- Flags the single primary Business Development contact — the /team
  -- page uses this to visually highlight one person, never several.
  is_bd_lead boolean not null default false,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create index if not exists idx_team_members_active_order on public.team_members (is_active, display_order);

-- Enforces "exactly one primary BD contact" at the database level: a
-- partial unique index only indexes rows where is_bd_lead = true, so a
-- second row trying to set is_bd_lead = true collides with the first
-- and is rejected — the UI (AdminTeam) doesn't have to get this right
-- on its own.
create unique index if not exists idx_team_members_single_bd_lead on public.team_members (is_bd_lead) where (is_bd_lead);

drop trigger if exists trg_team_members_updated_at on public.team_members;
create trigger trg_team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;

drop policy if exists "active team members are public" on public.team_members;
create policy "active team members are public"
  on public.team_members for select
  using (is_active = true or public.is_admin());

drop policy if exists "admins manage team members" on public.team_members;
create policy "admins manage team members"
  on public.team_members for insert with check (public.is_admin());
drop policy if exists "admins update team members" on public.team_members;
create policy "admins update team members"
  on public.team_members for update using (public.is_admin());
drop policy if exists "admins delete team members" on public.team_members;
create policy "admins delete team members"
  on public.team_members for delete using (public.is_admin());

-- Seed the official team — idempotent via the unique(name) constraint,
-- safe to re-run. Ordering matches the required display order
-- (Dacrypto, Crypto Testeer, Sammy). Telegram/X links use the clean
-- https://t.me/username / https://x.com/username form (no "@").
insert into public.team_members (name, primary_role, badges, x_url, telegram_url, bio, is_bd_lead, display_order, is_active)
values
  ('Dacrypto', 'Founder', '{}', 'https://x.com/0xrhydar', 'https://t.me/dacrypto_bull',
   'Founder of Monad Africa, building the gateway that connects the Monad ecosystem with Africa''s builders and communities.',
   false, 1, true),
  ('Crypto Testeer', 'Co-founder & Lead Business Development', array['Co-founder','Lead Business Development','Partnerships'], 'https://x.com/cryptotesteer', 'https://t.me/CryptoTesteer',
   'Primary contact for partnerships, sponsorships, collaborations, and ecosystem opportunities across Monad Africa.',
   true, 2, true),
  ('Sammy', 'Partnerships', '{}', 'https://x.com/samueldaodu22', 'https://t.me/Sammy_0125',
   'Supports partnerships and community collaborations for Monad Africa.',
   false, 3, true)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- PARTNERSHIP SUBMISSIONS — the "Partner With Monad Africa" (/partner)
-- contact form. Anyone (including logged-out visitors) can submit one,
-- mirroring the existing public.applications table's insert policy.
-- Submissions are never publicly readable — only admins/BD staff can
-- view, search, filter, annotate, or delete them.
-- ---------------------------------------------------------------------
create table if not exists public.partnership_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  organization text,
  email text not null,
  x_url text,
  telegram text,
  website text,
  partnership_type text not null default 'Other',
  message text not null,
  status text not null default 'New'
    check (status in ('New','Reviewing','Contacted','Accepted','Declined','Archived')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partnership_submissions_status on public.partnership_submissions (status);
create index if not exists idx_partnership_submissions_created_at on public.partnership_submissions (created_at desc);

drop trigger if exists trg_partnership_submissions_updated_at on public.partnership_submissions;
create trigger trg_partnership_submissions_updated_at before update on public.partnership_submissions
  for each row execute function public.set_updated_at();

alter table public.partnership_submissions enable row level security;

drop policy if exists "anyone can submit a partnership enquiry" on public.partnership_submissions;
create policy "anyone can submit a partnership enquiry"
  on public.partnership_submissions for insert
  with check (
    length(trim(full_name)) > 0
    and length(trim(email)) > 0
    and length(trim(message)) > 0
    and status = 'New' -- a submitter can never set their own status
    and admin_notes is null -- or leave themselves admin notes
  );

drop policy if exists "only admins can view partnership submissions" on public.partnership_submissions;
create policy "only admins can view partnership submissions"
  on public.partnership_submissions for select
  using (public.is_admin());

drop policy if exists "only admins can update partnership submissions" on public.partnership_submissions;
create policy "only admins can update partnership submissions"
  on public.partnership_submissions for update
  using (public.is_admin());

drop policy if exists "only admins can delete partnership submissions" on public.partnership_submissions;
create policy "only admins can delete partnership submissions"
  on public.partnership_submissions for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- STORAGE: dedicated public-read, admin-write bucket for team member
-- profile photos — mirrors the existing 'resources'/'videos' buckets
-- (admin-curated content), not the open 'logos' bucket (public uploads).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('team', 'team', true)
on conflict (id) do nothing;

drop policy if exists "public read team" on storage.objects;
create policy "public read team"
  on storage.objects for select
  using (bucket_id = 'team');

drop policy if exists "admins upload team" on storage.objects;
create policy "admins upload team"
  on storage.objects for insert
  with check (bucket_id = 'team' and public.is_admin());

drop policy if exists "admins delete storage objects" on storage.objects;
create policy "admins delete storage objects"
  on storage.objects for delete
  using (bucket_id in ('logos','resources','videos','team') and public.is_admin());

notify pgrst, 'reload schema';

-- =====================================================================
-- Done.
-- =====================================================================
