-- =====================================================================
-- Monad Africa — Admin access setup / repair
-- Run in Supabase Dashboard → SQL Editor.
-- Replace YOUR_EMAIL_HERE (both occurrences near the bottom) with the
-- email you log into the site with, then run the whole file.
-- Safe to re-run — every statement is idempotent.
-- =====================================================================

-- 1. Table (no-op if it already exists)
create table if not exists public.admins (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'moderator' check (role in ('super_admin', 'admin', 'moderator')),
  created_at timestamptz not null default now()
);

-- 2. Function + RLS policy the app's admin checks depend on
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

alter table public.admins enable row level security;

drop policy if exists "admins table managed by admins only" on public.admins;
create policy "admins table managed by admins only"
  on public.admins for all
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Grant your account super_admin — replace the email below
insert into public.admins (id, role)
select id, 'super_admin' from auth.users where email = 'YOUR_EMAIL_HERE'
on conflict (id) do update set role = 'super_admin';

-- 4. Verify
select u.email, a.role, a.created_at
from public.admins a
join auth.users u on u.id = a.id
where u.email = 'YOUR_EMAIL_HERE';
