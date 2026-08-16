-- =====================================================================
-- Monad Africa — 0026: Re-assert public (anon) read access to events
-- Run in Supabase SQL Editor AFTER 0001-0025.
--
-- WHY THIS FILE EXISTS: logged-out visitors get "Couldn't load events
-- right now" on the public Events page. The frontend query
-- (src/pages/Events.tsx) has no auth-gating logic at all — it runs the
-- exact same `select * from events where status <> 'draft' ...` query
-- regardless of session state. If it fails specifically for logged-out
-- (anon) visitors and not logged-in ones, the cause has to be at the
-- database layer: either the `anon` role is missing the base
-- table-level SELECT grant (a prerequisite for RLS to apply at all —
-- distinct from the RLS policy itself, which only filters rows once
-- that base privilege exists), or the policy has drifted from its
-- intended design. This file re-asserts both, exactly matching the
-- always-intended design (published events are public, drafts are
-- admin-only) — it does not change what the design was supposed to be,
-- only guarantees the database actually reflects it. No table is
-- altered, no row is touched, no other table's access changes.
-- =====================================================================

grant select on public.events to anon, authenticated;

drop policy if exists "events are public" on public.events;
create policy "events are public" on public.events for select
  using (status <> 'draft' or public.is_admin());

-- The registration-count RPC the public Events page also calls per
-- event — re-asserted for the same reason, matching its 0016 grant.
grant execute on function public.event_registration_count(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table altered, no row touched, no other table's grants or
-- policies changed.
-- =====================================================================
