-- =====================================================================
-- Monad Africa — 0029: Block new submissions to a closed bounty
-- Run in Supabase SQL Editor AFTER 0001-0028.
--
-- WHY THIS FILE EXISTS: "Close Bounty" already existed end-to-end for
-- new APPLICATIONS — apply_to_bounty() (see 0018) already raises
-- 'Bounty is not open for applications' when bounty.is_closed is true.
-- SUBMISSIONS (SubmissionModal.tsx) never went through that or any
-- other function — it's a direct `insert into submissions` from the
-- client, gated only by "signed-in users submit as themselves" (auth.
-- uid() = user_id). That policy has no idea whether the bounty behind
-- the submission is closed, so a user with an already-approved
-- application could still submit work after an admin closes the
-- bounty. This extends that one policy to also require the bounty not
-- be closed — enforced in the database, not just hidden/disabled in
-- the UI, per the requirement that closing a bounty can't be bypassed
-- by calling the API directly.
--
-- Does not touch the INSERT call in SubmissionModal.tsx, the table
-- shape, or any other policy — an already-open bounty's submission
-- flow (the one that's already tested and working) is completely
-- unaffected; this only adds a new rejection case that didn't exist
-- before (submitting against a bounty that's since been closed).
-- =====================================================================

drop policy if exists "signed-in users submit as themselves" on public.submissions;
create policy "signed-in users submit as themselves"
  on public.submissions for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.bounties b where b.id = bounty_id and b.is_closed
    )
  );

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table, column, or other policy touched. Existing open-bounty
-- submissions are unaffected — this only blocks the new closed-bounty
-- case that was previously unenforced.
-- =====================================================================
