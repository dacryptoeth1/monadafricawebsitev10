-- =====================================================================
-- Monad Africa — 0037: Partnership & Bounty hosting workflow overhaul
-- Run in Supabase SQL Editor AFTER 0001-0036.
-- Self-contained (IF NOT EXISTS / OR REPLACE throughout, safe to re-run).
--
-- WHAT THIS FILE DOES: replaces the old anonymous, unreviewed
-- "submit straight to the live table" flows for both partnership
-- enquiries and bounty hosting with a structured, signed-in,
-- admin-reviewed application workflow — per the spec:
--   1. public.partnership_applications  — new table, the "Partner With
--      Us" application (richer than the existing partnership_submissions,
--      which is left untouched/historical, no longer written to going
--      forward).
--   2. public.bounty_hosting_requests   — new table, the pre-publish
--      review lifecycle for a bounty pitch (draft -> pending_review ->
--      changes_requested/approved/rejected). HostBounty.tsx now inserts
--      here instead of directly into public.bounties.
--   3. public.bounties                  — EXTENDED (not replaced) with
--      the columns needed to represent the post-publish lifecycle
--      (verification_badge, completion_status, ...). Every existing
--      column, RLS policy, RPC, and admin flow on this table is
--      untouched.
--   4. public.submissions               — EXTENDED with the columns a
--      project needs to review its own bounty's submissions
--      (shortlisted, proposed_winner, project_feedback), locked down by
--      a column-protection trigger (same pattern as
--      0003_protect_profile_fields.sql) so a project can only ever touch
--      those three columns on its own bounty's submissions — never an
--      applicant's status, is_winner, or file/links.
--   5. public.bounty_completion_reports — new table + a public view
--      (same pattern as 0032's leaderboard_public) exposing only the
--      non-sensitive fields once an admin approves the report.
--   6. public.status_history            — new generic audit trail,
--      written automatically by trigger whenever any of the three
--      status-bearing tables above changes status.
--
-- Nothing here drops, renames, or narrows access to any existing table,
-- column, policy, or RPC.
-- =====================================================================

set lock_timeout = '5s';

-- =====================================================================
-- 1. PARTNERSHIP APPLICATIONS
-- =====================================================================
create table if not exists public.partnership_applications (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  project_name text not null,
  logo_url text,
  website text,
  x_username text,
  telegram text,
  contact_email text not null,
  contact_person text not null,
  category text,
  description text,
  partnership_type text not null default 'Other',
  needs_from_us text,
  offers_to_us text,
  target_countries text[] not null default '{}',
  supporting_links text,
  additional_info text,
  status text not null default 'Pending Review'
    check (status in ('Pending Review','Contacted','Under Discussion','Approved','Rejected','Active Partnership')),
  admin_notes text,
  assigned_admin uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partnership_applications_created_by on public.partnership_applications (created_by);
create index if not exists idx_partnership_applications_status on public.partnership_applications (status);
create index if not exists idx_partnership_applications_created_at on public.partnership_applications (created_at desc);

drop trigger if exists trg_partnership_applications_updated_at on public.partnership_applications;
create trigger trg_partnership_applications_updated_at before update on public.partnership_applications
  for each row execute function public.set_updated_at();

alter table public.partnership_applications enable row level security;

drop policy if exists "owners and admins view partnership applications" on public.partnership_applications;
create policy "owners and admins view partnership applications"
  on public.partnership_applications for select
  using (auth.uid() = created_by or public.is_admin());

drop policy if exists "signed-in users submit partnership applications" on public.partnership_applications;
create policy "signed-in users submit partnership applications"
  on public.partnership_applications for insert
  with check (
    auth.uid() = created_by
    and status = 'Pending Review' -- a submitter can never set their own status
    and admin_notes is null
    and assigned_admin is null
  );

drop policy if exists "only admins update partnership applications" on public.partnership_applications;
create policy "only admins update partnership applications"
  on public.partnership_applications for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "only admins delete partnership applications" on public.partnership_applications;
create policy "only admins delete partnership applications"
  on public.partnership_applications for delete
  using (public.is_admin());

-- Duplicate-submission guard: one in-flight application per user at a
-- time. Once it leaves the mid-review states (Approved/Rejected/Active
-- Partnership) a new one is allowed again.
create or replace function public.reject_duplicate_partnership_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.partnership_applications
    where created_by = new.created_by
      and status in ('Pending Review','Contacted','Under Discussion')
  ) then
    raise exception 'You already have a partnership application in review — please wait for a response before submitting another.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_duplicate_partnership_application on public.partnership_applications;
create trigger trg_reject_duplicate_partnership_application
  before insert on public.partnership_applications
  for each row execute function public.reject_duplicate_partnership_application();

-- Auto-stamp reviewed_at/approved_at + write the shared status_history
-- audit trail whenever status actually changes — never trusts the
-- client to send correct timestamps (same reasoning as
-- bounties_set_lifecycle_audit in migration 0031).
create or replace function public.partnership_application_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    if new.status in ('Approved','Active Partnership') then
      new.approved_at := coalesce(old.approved_at, now());
    end if;
    insert into public.status_history (entity_type, entity_id, old_status, new_status, changed_by)
    values ('partnership_application', new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_partnership_application_status_transition on public.partnership_applications;
create trigger trg_partnership_application_status_transition
  before update on public.partnership_applications
  for each row execute function public.partnership_application_status_transition();

-- =====================================================================
-- 2. BOUNTY HOSTING REQUESTS — pre-publish review lifecycle
-- =====================================================================
create table if not exists public.bounty_hosting_requests (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  project_name text,
  logo_url text,
  website text,
  x_username text,
  telegram text,
  contact_email text,
  contact_person text,
  title text,
  description text,
  category text check (category is null or category in ('Development','Design','Marketing','Community','Content')),
  required_skills text,
  eligibility text,
  deliverables text,
  num_winners int,
  total_reward text,
  reward_currency text,
  reward_distribution text,
  submission_deadline date,
  winner_announcement_date date,
  payment_method text,
  proof_of_funds_url text,
  relevant_links text,
  terms text,
  additional_info text,
  status text not null default 'draft'
    check (status in ('draft','pending_review','changes_requested','approved','rejected')),
  admin_notes text,
  assigned_admin uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_bounty_id uuid references public.bounties (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bounty_hosting_requests_required_when_submitted check (
    status = 'draft' or (
      project_name is not null and length(trim(project_name)) > 0 and
      contact_email is not null and length(trim(contact_email)) > 0 and
      contact_person is not null and length(trim(contact_person)) > 0 and
      title is not null and length(trim(title)) > 0 and
      description is not null and length(trim(description)) > 0 and
      category is not null and
      num_winners is not null and num_winners > 0 and
      total_reward is not null and length(trim(total_reward)) > 0 and
      reward_currency is not null and length(trim(reward_currency)) > 0 and
      submission_deadline is not null
    )
  )
);

create index if not exists idx_bounty_hosting_requests_created_by on public.bounty_hosting_requests (created_by);
create index if not exists idx_bounty_hosting_requests_status on public.bounty_hosting_requests (status);
create index if not exists idx_bounty_hosting_requests_created_at on public.bounty_hosting_requests (created_at desc);

drop trigger if exists trg_bounty_hosting_requests_updated_at on public.bounty_hosting_requests;
create trigger trg_bounty_hosting_requests_updated_at before update on public.bounty_hosting_requests
  for each row execute function public.set_updated_at();

alter table public.bounty_hosting_requests enable row level security;

drop policy if exists "owners and admins view bounty hosting requests" on public.bounty_hosting_requests;
create policy "owners and admins view bounty hosting requests"
  on public.bounty_hosting_requests for select
  using (auth.uid() = created_by or public.is_admin());

drop policy if exists "signed-in users start a bounty hosting request" on public.bounty_hosting_requests;
create policy "signed-in users start a bounty hosting request"
  on public.bounty_hosting_requests for insert
  with check (
    auth.uid() = created_by
    and status = 'draft'
    and admin_notes is null
    and assigned_admin is null
  );

-- Owner can keep revising (autosave, and fixing up after "changes
-- requested") right up until it's approved/rejected — but can only ever
-- move it back into draft or pending_review themselves, never approve
-- or reject their own request.
drop policy if exists "owners revise their own open bounty hosting request" on public.bounty_hosting_requests;
create policy "owners revise their own open bounty hosting request"
  on public.bounty_hosting_requests for update
  using (auth.uid() = created_by and status in ('draft','pending_review','changes_requested'))
  with check (auth.uid() = created_by and status in ('draft','pending_review'));

drop policy if exists "admins manage bounty hosting requests" on public.bounty_hosting_requests;
create policy "admins manage bounty hosting requests"
  on public.bounty_hosting_requests for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "owners delete their own draft bounty hosting request" on public.bounty_hosting_requests;
create policy "owners delete their own draft bounty hosting request"
  on public.bounty_hosting_requests for delete
  using (auth.uid() = created_by and status = 'draft');

drop policy if exists "admins delete bounty hosting requests" on public.bounty_hosting_requests;
create policy "admins delete bounty hosting requests"
  on public.bounty_hosting_requests for delete
  using (public.is_admin());

-- One in-flight (draft through changes_requested) request per user at a
-- time — once approved or rejected, a new one is allowed.
create or replace function public.reject_duplicate_bounty_hosting_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.bounty_hosting_requests
    where created_by = new.created_by
      and status in ('draft','pending_review','changes_requested')
  ) then
    raise exception 'You already have a bounty hosting request in progress — finish or wait on that one before starting another.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_duplicate_bounty_hosting_request on public.bounty_hosting_requests;
create trigger trg_reject_duplicate_bounty_hosting_request
  before insert on public.bounty_hosting_requests
  for each row execute function public.reject_duplicate_bounty_hosting_request();

create or replace function public.bounty_hosting_request_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    if new.status = 'approved' then
      new.approved_at := coalesce(old.approved_at, now());
    end if;
    insert into public.status_history (entity_type, entity_id, old_status, new_status, changed_by)
    values ('bounty_hosting_request', new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bounty_hosting_request_status_transition on public.bounty_hosting_requests;
create trigger trg_bounty_hosting_request_status_transition
  before update on public.bounty_hosting_requests
  for each row execute function public.bounty_hosting_request_status_transition();

-- =====================================================================
-- 3. BOUNTIES — extend for the post-publish lifecycle + verification
-- badge. Every existing column/policy/RPC on this table is untouched.
-- =====================================================================
alter table public.bounties
  add column if not exists hosting_request_id uuid references public.bounty_hosting_requests (id) on delete set null,
  add column if not exists verification_badge text not null default 'community'
    check (verification_badge in ('verified','partner','community')),
  add column if not exists assigned_admin uuid references public.profiles (id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists completion_status text not null default 'none'
    check (completion_status in ('none','under_review','completed','cancelled','expired'));

create index if not exists idx_bounties_hosting_request on public.bounties (hosting_request_id);
create index if not exists idx_bounties_completion_status on public.bounties (completion_status);

create or replace function public.log_bounty_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status or new.completion_status is distinct from old.completion_status then
    insert into public.status_history (entity_type, entity_id, old_status, new_status, changed_by)
    values ('bounty', new.id, old.status || '/' || old.completion_status, new.status || '/' || new.completion_status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bounties_status_history on public.bounties;
create trigger trg_bounties_status_history
  before update on public.bounties
  for each row execute function public.log_bounty_status_change();

-- Publishes an approved hosting request as a live, verified bounty.
-- Admin-only. Copies the reviewed fields across, links the two rows
-- both ways, and can only ever run once per request.
create or replace function public.publish_bounty_hosting_request(p_request_id uuid)
returns public.bounties
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.bounty_hosting_requests%rowtype;
  v_bounty public.bounties%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish a bounty';
  end if;

  select * into v_req from public.bounty_hosting_requests where id = p_request_id;
  if not found then
    raise exception 'Bounty hosting request not found';
  end if;
  if v_req.status <> 'approved' then
    raise exception 'Only an approved hosting request can be published';
  end if;
  if v_req.published_bounty_id is not null then
    raise exception 'This request has already been published';
  end if;

  insert into public.bounties (
    project_name, logo_url, website, twitter, contact_email,
    title, description, skills_needed, category, difficulty, reward, deadline,
    status, hosting_request_id, verification_badge, assigned_admin, published_at
  ) values (
    v_req.project_name, v_req.logo_url, v_req.website, v_req.x_username, v_req.contact_email,
    v_req.title, v_req.description, v_req.required_skills, coalesce(v_req.category, 'Development'), 'medium',
    coalesce(v_req.total_reward, ''), coalesce(v_req.submission_deadline, current_date + interval '30 days'),
    'approved', v_req.id, 'verified', v_req.assigned_admin, now()
  )
  returning * into v_bounty;

  update public.bounty_hosting_requests
  set published_bounty_id = v_bounty.id
  where id = p_request_id;

  return v_bounty;
end;
$$;

revoke all on function public.publish_bounty_hosting_request(uuid) from public;
grant execute on function public.publish_bounty_hosting_request(uuid) to authenticated;

-- =====================================================================
-- 4. SUBMISSIONS — extend for project-side review, locked to only the
-- 3 new columns via a column-protection trigger (same pattern as
-- 0003_protect_profile_fields.sql).
-- =====================================================================
alter table public.submissions
  add column if not exists shortlisted boolean not null default false,
  add column if not exists proposed_winner boolean not null default false,
  add column if not exists project_feedback text;

-- The project that owns the bounty (via bounties.hosting_request_id ->
-- bounty_hosting_requests.created_by) can now also UPDATE its own
-- bounty's submissions — previously admin-only. The trigger below is
-- what actually keeps this safe: it reverts every column except
-- shortlisted/proposed_winner/project_feedback for any non-admin
-- updater, so this new UPDATE access can never be used to alter an
-- applicant's status, is_winner flag, or submitted links/files.
drop policy if exists "project owners update own bounty submissions" on public.submissions;
create policy "project owners update own bounty submissions"
  on public.submissions for update
  using (
    exists (
      select 1 from public.bounties b
      join public.bounty_hosting_requests r on r.id = b.hosting_request_id
      where b.id = submissions.bounty_id and r.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bounties b
      join public.bounty_hosting_requests r on r.id = b.hosting_request_id
      where b.id = submissions.bounty_id and r.created_by = auth.uid()
    )
  );

create or replace function public.protect_submission_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.application_id := old.application_id;
    new.bounty_id := old.bounty_id;
    new.user_id := old.user_id;
    new.github_repo := old.github_repo;
    new.x_post_link := old.x_post_link;
    new.google_docs_link := old.google_docs_link;
    new.website_link := old.website_link;
    new.file_url := old.file_url;
    new.additional_notes := old.additional_notes;
    new.status := old.status;
    new.is_winner := old.is_winner;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_submission_fields_trigger on public.submissions;
create trigger protect_submission_fields_trigger
  before update on public.submissions
  for each row execute function public.protect_submission_fields();

-- =====================================================================
-- 5. BOUNTY COMPLETION REPORTS
-- =====================================================================
create table if not exists public.bounty_completion_reports (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null unique references public.bounties (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  submissions_count int,
  -- Array of {submission_id, wallet_or_payment_details, reward_amount,
  -- tx_hash} — private, never exposed by the public view below.
  winners jsonb not null default '[]'::jsonb,
  summary text,
  winning_submission_links text,
  project_feedback text,
  participant_feedback text,
  unresolved_issues text,
  status text not null default 'draft' check (status in ('draft','submitted','approved')),
  admin_notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bounty_completion_reports_bounty on public.bounty_completion_reports (bounty_id);

drop trigger if exists trg_bounty_completion_reports_updated_at on public.bounty_completion_reports;
create trigger trg_bounty_completion_reports_updated_at before update on public.bounty_completion_reports
  for each row execute function public.set_updated_at();

alter table public.bounty_completion_reports enable row level security;

drop policy if exists "owners and admins view completion reports" on public.bounty_completion_reports;
create policy "owners and admins view completion reports"
  on public.bounty_completion_reports for select
  using (auth.uid() = created_by or public.is_admin());

drop policy if exists "project owners create own completion report" on public.bounty_completion_reports;
create policy "project owners create own completion report"
  on public.bounty_completion_reports for insert
  with check (
    auth.uid() = created_by
    and status = 'draft'
    and exists (
      select 1 from public.bounties b
      join public.bounty_hosting_requests r on r.id = b.hosting_request_id
      where b.id = bounty_id and r.created_by = auth.uid()
    )
  );

drop policy if exists "project owners update own draft completion report" on public.bounty_completion_reports;
create policy "project owners update own draft completion report"
  on public.bounty_completion_reports for update
  using (auth.uid() = created_by and status = 'draft')
  with check (auth.uid() = created_by and status in ('draft','submitted'));

drop policy if exists "admins manage completion reports" on public.bounty_completion_reports;
create policy "admins manage completion reports"
  on public.bounty_completion_reports for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete completion reports" on public.bounty_completion_reports;
create policy "admins delete completion reports"
  on public.bounty_completion_reports for delete
  using (public.is_admin());

-- Public, sanitized view — only approved reports, only non-sensitive
-- fields (no wallet addresses, payment details, or tx hashes). Same
-- "view owned by the table owner bypasses the base table's RLS" trick
-- as leaderboard_public (migration 0032).
create or replace view public.bounty_completion_reports_public as
select bounty_id, submissions_count, summary, winning_submission_links, unresolved_issues, approved_at
from public.bounty_completion_reports
where status = 'approved';

grant select on public.bounty_completion_reports_public to anon, authenticated;

-- Admin action: approve a submitted completion report and mark the
-- bounty completed, atomically, with its own audit trail entry (via the
-- bounties status-history trigger above).
create or replace function public.admin_approve_completion_report(p_bounty_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve a completion report';
  end if;

  update public.bounty_completion_reports
  set status = 'approved', approved_at = now()
  where bounty_id = p_bounty_id and status = 'submitted';

  if not found then
    raise exception 'No submitted completion report found for this bounty';
  end if;

  update public.bounties set completion_status = 'completed' where id = p_bounty_id;
end;
$$;

revoke all on function public.admin_approve_completion_report(uuid) from public;
grant execute on function public.admin_approve_completion_report(uuid) to authenticated;

-- =====================================================================
-- 6. STATUS HISTORY — generic audit trail, system-written only (no
-- insert/update/delete policy for anon/authenticated at all; every
-- write above goes through a security-definer trigger function, which
-- runs with the table-owner role and bypasses RLS the same way every
-- other trigger-driven audit column in this schema already does).
-- =====================================================================
create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('partnership_application','bounty_hosting_request','bounty')),
  entity_id uuid not null,
  old_status text,
  new_status text,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_status_history_entity on public.status_history (entity_type, entity_id, created_at desc);

alter table public.status_history enable row level security;

drop policy if exists "owners and admins view status history" on public.status_history;
create policy "owners and admins view status history"
  on public.status_history for select
  using (
    public.is_admin()
    or (entity_type = 'partnership_application' and exists (
      select 1 from public.partnership_applications p where p.id = entity_id and p.created_by = auth.uid()))
    or (entity_type = 'bounty_hosting_request' and exists (
      select 1 from public.bounty_hosting_requests r where r.id = entity_id and r.created_by = auth.uid()))
    or (entity_type = 'bounty' and exists (
      select 1 from public.bounties b
      join public.bounty_hosting_requests r on r.id = b.hosting_request_id
      where b.id = entity_id and r.created_by = auth.uid()))
  );

-- =====================================================================
-- 7. STORAGE: private, owner-scoped bucket for proof-of-funds /
-- supporting documents — distinct from the public 'logos' bucket
-- (reused as-is for project/bounty logos, already open-upload).
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('bounty_documents', 'bounty_documents', false)
on conflict (id) do nothing;

drop policy if exists "owners and admins read own bounty documents" on storage.objects;
create policy "owners and admins read own bounty documents"
  on storage.objects for select
  using (bucket_id = 'bounty_documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "owners upload own bounty documents" on storage.objects;
create policy "owners upload own bounty documents"
  on storage.objects for insert
  with check (bucket_id = 'bounty_documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Re-assert the admin-delete-storage-objects policy (0035) including the
-- new bucket, so admins can clean up rejected/expired uploads.
drop policy if exists "admins delete storage objects" on storage.objects;
create policy "admins delete storage objects"
  on storage.objects for delete
  using (bucket_id in ('logos','resources','videos','team','bounty_documents') and public.is_admin());

-- =====================================================================
-- 8. Write privileges — belt-and-suspenders alongside 0036's
-- `alter default privileges`, explicit for every table this file adds.
-- =====================================================================
grant select, insert, update, delete on public.partnership_applications to anon, authenticated;
grant select, insert, update, delete on public.bounty_hosting_requests to anon, authenticated;
grant select, insert, update, delete on public.bounty_completion_reports to anon, authenticated;
grant select on public.status_history to anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No existing table, column, policy, RPC, or row was dropped,
-- renamed, or narrowed — this is strictly additive.
-- =====================================================================
