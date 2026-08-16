-- =====================================================================
-- Monad Africa — 0020: Repair any existing invalid profiles.role values
-- Run in Supabase SQL Editor AFTER 0001-0019.
--
-- WHY THIS FILE EXISTS: profiles_role_check only accepts the six exact
-- UserRole strings or NULL. Every write path in the application code
-- has been audited and already only ever sends one of those six values
-- or omits the column — but Postgres CHECK constraints re-validate the
-- ENTIRE resulting row on every UPDATE, not just the columns being
-- changed. If any row's role was set to something outside the allowed
-- list before that guarantee existed (an empty string from a stale
-- client build, a manual edit in the Supabase Table Editor, etc.),
-- every future save on that row — even one that never touches role —
-- fails profiles_role_check, no matter how correct the new save code
-- is. This does NOT change the constraint. It repairs the handful of
-- rows (if any) that violate it, the only way that's safe: setting
-- role to NULL (always valid) so the user can pick a real role again
-- next time they save. No other column on any row is touched.
-- =====================================================================

do $$
declare
  v_bad_count int;
begin
  select count(*) into v_bad_count
  from public.profiles
  where role is not null
    and role not in ('Developer','Designer','Content Creator','Community Member','Founder','Student');

  if v_bad_count > 0 then
    raise notice 'Found % profiles row(s) with an invalid role value — repairing to NULL.', v_bad_count;
  else
    raise notice 'No profiles rows with an invalid role value found.';
  end if;
end $$;

update public.profiles
set role = null
where role is not null
  and role not in ('Developer','Designer','Content Creator','Community Member','Founder','Student');

-- =====================================================================
-- Done. Only the role column, only on rows that already violated
-- profiles_role_check, is touched. No constraint changed, no other
-- data affected.
-- =====================================================================
