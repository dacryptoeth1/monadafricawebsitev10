set lock_timeout = '5s';

drop policy if exists "signed-in users submit as themselves" on public.submissions;

create policy "signed-in users submit as themselves"
  on public.submissions for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.bounties b where b.id = bounty_id and b.is_closed
    )
  );
