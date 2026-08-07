-- =====================================================================
-- Monad Africa — 0003: Protect sensitive profile fields
-- Run in Supabase SQL Editor AFTER 0002_user_platform.sql.
--
-- Why: the existing "profiles editable by owner or admin" policy (from
-- 0001) lets a signed-in user UPDATE their own profiles row with no
-- column restriction — which means credits, referral_code, referred_by,
-- and total_referrals could be edited directly via the Supabase client,
-- bypassing the app entirely. Row Level Security alone can't restrict
-- individual columns, so this adds a trigger that silently reverts
-- those specific fields back to their previous value unless the actor
-- is an admin. Everything else on the row (full_name, username, avatar,
-- country, role, bio) remains freely editable by the owner, unchanged.
-- =====================================================================

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.credits := old.credits;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.total_referrals := old.total_referrals;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields_trigger on public.profiles;
create trigger protect_profile_fields_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- =====================================================================
-- Done. No existing data, tables, or policies were removed.
-- =====================================================================
