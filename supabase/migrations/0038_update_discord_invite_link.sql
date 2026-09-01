-- =====================================================================
-- Monad Africa — 0038: Update the Discord invite link
-- Run in Supabase SQL Editor AFTER 0001-0037.
--
-- WHY THIS FILE EXISTS: `public.site_settings.discord_url` is a single
-- admin-editable row (id=1), read live by useSiteSettings.ts and shown
-- on Home/Bounties/Community wherever the code uses the fetched
-- `settings.discord_url` rather than the hardcoded `defaultSiteSettings`
-- fallback in src/types.ts. Changing that fallback's source string (and
-- every `discord_url text default '...'` column default across the
-- migrations/setup scripts) only affects a brand-new install — it does
-- NOT change the value already sitting in this table's existing row.
-- This is the one statement that actually updates what's live today.
-- =====================================================================

update public.site_settings
set discord_url = 'https://discord.gg/9Fj5KtQCS'
where id = 1;

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No table, column, or policy touched — only this one row's value.
-- =====================================================================
