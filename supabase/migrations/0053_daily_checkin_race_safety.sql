-- =====================================================================
-- Monad Africa — 0053: Daily check-in race-condition hardening
-- Run in Supabase SQL Editor AFTER 0052.
--
-- daily_checkin() (0050) already re-verifies the calendar date
-- server-side on every call, which is what stops a manipulated client
-- clock or a replayed request from awarding XP twice. What it didn't
-- close is a genuine concurrency race: two calls for the same user
-- landing in the database at almost exactly the same instant (a
-- double-click that both reach the server before either commits, or
-- two open tabs) could both read last_checkin_date as "not today"
-- before either write took effect, and both go on to grant XP.
--
-- The fix is a single added clause: `select ... for update` row-locks
-- this user's profiles row for the rest of the transaction. The first
-- concurrent call takes the lock and proceeds as before; a second call
-- arriving a moment later simply waits for that lock, then — once it
-- acquires it — re-reads a last_checkin_date that the first call has
-- already updated to today, so it correctly falls into the
-- already-checked-in branch instead of awarding a second +1. No
-- change to the function's behavior for the ordinary single-call case,
-- or to its signature/return shape.
-- =====================================================================
create or replace function public.daily_checkin()
returns table (
  success boolean,
  already_checked_in boolean,
  xp int,
  checkin_streak int,
  checkin_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_new_streak int;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.last_checkin_date = v_today then
    return query select false, true, v_profile.xp, v_profile.checkin_streak, v_today;
    return;
  end if;

  v_new_streak := case when v_profile.last_checkin_date = v_today - 1 then v_profile.checkin_streak + 1 else 1 end;

  update public.profiles
  set last_checkin_date = v_today, checkin_streak = v_new_streak
  where id = auth.uid();

  perform public.grant_xp(auth.uid(), public.xp_reward('daily_checkin'), 'daily_checkin:' || v_today::text);

  insert into public.notifications (user_id, type, title, message)
  values (auth.uid(), 'xp_awarded', 'Daily check-in complete', '+' || public.xp_reward('daily_checkin') || ' XP — come back tomorrow to keep your streak going.');

  select * into v_profile from public.profiles where id = auth.uid();

  return query select true, false, v_profile.xp, v_profile.checkin_streak, v_today;
end;
$$;
