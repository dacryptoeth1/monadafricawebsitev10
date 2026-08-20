-- =====================================================================
-- Monad Africa — 0034: Password reset request cooldown ledger.
-- Run in Supabase SQL Editor AFTER 0001-0033.
--
-- WHY THIS EXISTS: netlify/functions/password-reset-request.ts (new)
-- issues Supabase's own recovery OTP via the Admin API
-- (auth.admin.generateLink({ type: 'recovery', ... })) and emails the
-- code itself via Resend — deliberately bypassing Supabase's built-in
-- "Reset Password" auth email entirely. That built-in email is stuck on
-- Supabase's default, link-based template: Supabase only unlocks
-- template editing once Custom SMTP is enabled on the project, and this
-- project is intentionally not doing that. Calling the Admin API
-- directly sidesteps the locked template altogether — the OTP it
-- returns (properties.email_otp) is the exact same value
-- supabase.auth.verifyOtp({ type: 'recovery' }) expects, so the rest of
-- the flow is still 100% native Supabase Auth, not a custom OTP system.
--
-- The one thing the Admin API does NOT do for us that the public
-- resetPasswordForEmail() endpoint normally would is rate-limit resend
-- spam — admin.generateLink() has no built-in per-email cooldown. This
-- table is that missing enforcement point: one row per email, holding
-- only when a code was last requested. Mirrors the pattern
-- event_email_verifications (0033) already established for a similar
-- email-OTP endpoint.
-- =====================================================================

create table if not exists public.password_reset_cooldowns (
  email text primary key,
  last_sent_at timestamptz not null default now()
);

alter table public.password_reset_cooldowns enable row level security;

-- No select/insert/update/delete policy for anon/authenticated at all —
-- nothing client-side ever needs to read or write this table. The only
-- writer is netlify/functions/password-reset-request.ts's service-role
-- client, which bypasses RLS entirely (same as every other Netlify
-- Function in this codebase that touches a service-role-only table).

notify pgrst, 'reload schema';

-- =====================================================================
-- Done. No existing table, policy, or function is touched.
-- =====================================================================
