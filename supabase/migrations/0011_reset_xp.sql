-- =====================================================================
-- Monad Africa — 0011: Reset XP admin action
-- Run in Supabase SQL Editor AFTER 0001-0010.
-- =====================================================================

create or replace function public.admin_reset_xp(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_old_xp int;
begin
  if not public.is_staff_admin() then
    raise exception 'Only Admins and Super Admins can reset XP';
  end if;

  select xp into v_old_xp from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  perform public.grant_xp(p_user_id, -v_old_xp, 'admin_reset');

  select * into v_profile from public.profiles where id = p_user_id;
  return v_profile;
end;
$$;

-- =====================================================================
-- Done.
-- =====================================================================
