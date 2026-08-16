-- =====================================================================
-- Monad Africa — 0019: Verify + reload PostgREST schema cache for
-- public.profiles.full_name
-- Run in Supabase SQL Editor AFTER 0001-0018.
--
-- WHY THIS FILE EXISTS: after 0018 added profiles.full_name back,
-- saving a profile still failed with the app's own
-- "database hasn't picked up a recent schema change yet" message —
-- meaning either 0018 was never actually run against this database, or
-- it ran but PostgREST's cached schema still doesn't reflect it. This
-- file is a small, self-contained, fully idempotent check-and-fix:
--   1. Reports (via RAISE NOTICE, visible in the SQL Editor's Messages
--      panel) whether public.profiles.full_name exists right now.
--   2. Re-runs `add column if not exists full_name text` as a harmless
--      backstop — a no-op if it's already there, safe to run any
--      number of times, touches no existing data.
--   3. Sends NOTIFY pgrst, 'reload schema' again.
--   4. Reports the column's existence a second time, so the Messages
--      panel shows the before/after state in one run.
-- Nothing here alters, drops, or resets any existing column or row.
-- =====================================================================

do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) into v_exists;

  if v_exists then
    raise notice 'BEFORE: public.profiles.full_name already exists.';
  else
    raise notice 'BEFORE: public.profiles.full_name does NOT exist yet — adding it now.';
  end if;
end $$;

alter table public.profiles add column if not exists full_name text;

notify pgrst, 'reload schema';

do $$
declare
  v_exists boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) into v_exists;

  if v_exists then
    raise notice 'AFTER: public.profiles.full_name exists. Schema cache reload sent — if the app still reports the same error, wait a few seconds and retry, or use Settings → API → "Reload schema cache" in the Supabase dashboard as a manual fallback.';
  else
    -- Should be unreachable given the ADD COLUMN above, but fails loudly
    -- instead of silently if something unexpected is blocking it (e.g.
    -- a permissions issue running this script).
    raise exception 'AFTER: public.profiles.full_name still does not exist — the ADD COLUMN above did not take effect. Check for errors earlier in this script''s output.';
  end if;
end $$;

-- =====================================================================
-- Done. No table dropped, no existing column altered/removed, no user
-- data touched or reset.
-- =====================================================================
