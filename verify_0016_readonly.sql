-- =====================================================================
-- READ-ONLY verification for 0016 — not a migration, nothing to apply,
-- safe to run any number of times. No ALTER/CREATE/UPDATE/DELETE.
-- Run each block in the SQL Editor and check the results.
-- =====================================================================

-- 1. events: the registration columns should all be present.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'events'
  and column_name in ('start_time','end_time','location','image_url','event_url','capacity','registration_deadline','registration_open','status','created_by','updated_at')
order by column_name;
-- Expect: 11 rows, one per column listed above.

-- 2. event_registrations: event_id should now be present.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'event_registrations'
order by ordinal_position;
-- Expect: event_id (uuid) listed among the columns.

-- 3. Indexes on event_registrations — the two that were failing before.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'event_registrations'
order by indexname;
-- Expect to see idx_event_registrations_event_email,
-- idx_event_registrations_event, and idx_event_registrations_invite_code.

-- 4. The events RLS select policy — should reference status now.
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'events';
-- Expect "events are public" with qual mentioning status <> 'draft'.

-- 5. Sanity: does the events table actually have any rows, and what do
-- their status values look like? (helps distinguish "query works but
-- table is empty" from "query still broken")
select count(*) as total_events, count(*) filter (where status = 'published') as published_events
from public.events;
