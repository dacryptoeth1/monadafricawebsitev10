# CHANGELOG — XP, Badges, Roles, Settings & Activity

## New database migration
- **`supabase/migrations/0006_xp_badges_roles_settings.sql`** — run after 0001-0005. Self-contained (`IF NOT EXISTS`/`CREATE OR REPLACE` throughout, safe to re-run).

### What it adds
- **Roles**: `admins.role` now allows `'super_admin' | 'admin' | 'moderator'` (was `'super_admin' | 'moderator'`). `profiles.is_ambassador` added as a separate flag (Ambassador is a public status, not an admin-panel permission tier). "Member" is simply the default when neither applies.
- **XP system**: `profiles.xp` (int, `CHECK (xp >= 0)`), `xp_transactions` table (full history, same pattern as `credit_transactions`). The actual XP-writing function, `grant_xp()`, is `REVOKE`d from `authenticated`/`anon` — it's only reachable from inside other trusted `SECURITY DEFINER` functions, not callable directly from the browser. This matters: without that revoke, any signed-in user could call it directly and grant themselves unlimited XP.
- **Badges**: `badges` catalog table (seeded with the 8 badges from the brief), `user_badges` join table, `award_badge()` (same non-callable-directly pattern as `grant_xp`).
- **`admin_award_xp`**, **`admin_award_badge`** — admin-only wrappers that check `is_admin()` then call the internal functions.
- **`admin_approve_submission()`** — replaces the plain `UPDATE` the admin dashboard used to run directly. Atomically: marks the submission approved, grants +50 XP, awards the "Bounty Hunter" badge (first approval only), and sends a "won bounty" notification.
- **`claim_profile_completion_bonus()`** — called from the client after a profile save. Re-checks completion server-side (doesn't trust a client-sent flag) and pays out +20 XP exactly once per account (`profiles.profile_complete_bonus_awarded`).
- **`ensure_profile()`** — safety net. If a signed-in user has no `profiles` row (failed trigger, pre-trigger account, etc.), creates one with the standard 3-credit grant on next login.
- **`self_delete_account()`** — Settings page "Delete Account". Same honest limitation as the admin equivalent from last round: removes profile/application/submission/credit/XP/badge data, does **not** delete the login itself (needs the Supabase Admin API + `service_role`, which can't run client-side).
- **`admin_adjust_credits()`** re-created to also insert a notification (was missing — the brief calls out "Credits awarded" as a required notification type).
- **`handle_new_user()`** re-created: unchanged 3-credit grant, now also grants the referrer +10 XP alongside their existing +1 credit.
- **`apply_to_bounty()`** re-created: unchanged credit deduction, now also grants the applicant +15 XP.
- Notification `type` check constraint widened to include `xp_awarded`, `badge_earned`, `credits_awarded`, `announcement`, `won_bounty`.
- `bounties.is_featured` added (admin "Feature Bounties" capability).

## New dependency
None — this round reused existing packages (no new npm installs).

## Files changed

### Auth
- **`src/context/AuthContext.tsx`** — removed `signInWithApple` entirely (interface, implementation, provider value). Added self-heal: if login finds no profile row, calls `ensure_profile()` automatically rather than leaving the user with a blank/broken profile.
- **`src/components/SocialAuthButtons.tsx`** — rewritten, Google only.
- **`src/lib/supabase.ts`** — corrected a stale comment that still mentioned Apple.

### Profile
- **`src/pages/Profile.tsx`** — added EVM wallet address validation (`/^0x[a-fA-F0-9]{40}$/`, rejected with a clear error if invalid and non-empty), friendly duplicate-username error (catches Postgres `23505` and rewords it instead of showing a raw DB error), calls `claim_profile_completion_bonus()` after every save, fetches and displays earned badges, now renders the new `ProfileStatsHeader` at the top.
- **`src/components/ProfileStatsHeader.tsx`** *(new)* — shared component: username, credits, XP, rank, referrals, applications breakdown (applied/approved/pending/rejected), profile completion %, referral code, wallet, badges. Used on Profile; Dashboard keeps its own richer version of some of these alongside operational lists (applied bounties, submissions, notifications).

### XP / Leaderboard
- **`src/pages/Leaderboard.tsx`** *(new)* — "🏆 African Leaderboard", ranks all users by XP, top 3 get medal emoji, top 50 shown.
- **`src/pages/Dashboard.tsx`** — added an XP stat card; switched the rank calculation from referral-count-based to XP-based (consistent with the new Leaderboard's ranking metric); added an "Activity" link next to "Edit Profile".

### Settings & Activity (new pages)
- **`src/pages/Settings.tsx`** *(new)* — change password, change email (triggers Supabase's built-in reconfirmation flow on both addresses), toggle in-app notifications (`profiles.notifications_enabled`), delete account (requires typing your exact username to confirm, calls `self_delete_account()`, signs out).
- **`src/pages/ActivityHistory.tsx`** *(new)* — unified timeline merging credit transactions, XP transactions, bounty applications, and referral joins into one sorted feed.

### Homepage
- **`src/pages/Home.tsx`** — Live Stats section extended with real `Registered Users` (live `profiles` count) and `Completed Bounties` (live count of `is_closed` bounties) — no more placeholder/hardcoded values there. Replaced the old "no featured builders yet" empty-state section with two real, data-driven sections: a Leaderboard preview (top 5 by XP) and Featured Contributors (top 6 by referral count) — both render honest empty states if there's no data yet, no fabricated names or content.

### Admin Dashboard
- **`src/pages/admin/AdminDashboard.tsx`**:
  - Submission approval now calls `admin_approve_submission()` instead of a plain `UPDATE`, so XP/badge/notification all fire correctly.
  - Users panel: added the `admin` role tier to both the filter and the role-change dropdown; added "Sort by XP"; added +10/-10 XP buttons (via `admin_award_xp`); added "Make/Remove ambassador" toggle (also auto-awards the 🤝 Ambassador badge); added **Export Users** CSV button (username, name, email, country, region, role, credits, XP, referrals, wallet, suspended/banned flags, joined date).

### Routing & navigation
- **`src/App.tsx`** — added lazy-loaded routes for `/leaderboard` (public), `/settings` and `/activity` (both behind `RequireAuth`).
- **`src/components/Layout.tsx`** — added "Leaderboard" to the main public nav (both desktop and mobile, since they share one array); added "Settings" to the desktop auth nav and "Settings"/"Activity" to the mobile auth menu.
- **`src/types.ts`** — extended `Profile` (xp, is_ambassador, profile_complete_bonus_awarded, notifications_enabled), extended `Bounty` (is_featured), extended `AdminRole` (added `'admin'`), added `Badge`, `UserBadge`, `XpTransaction` types.

## Manual Supabase steps required
1. Run `0006_xp_badges_roles_settings.sql` in the SQL Editor (after 0001-0005).
2. Nothing else new this round — auth redirect URLs, Google OAuth provider setup, and Discord widget setup from previous rounds still apply if you haven't done them yet.

## Manual Netlify steps required
None new. Same two env vars as before (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), no new ones introduced.

## Verified before returning
- `tsc -b` — clean, no errors.
- `vite build` — clean, 2607 modules, main bundle unchanged in size (~522KB / 155KB gzipped) despite all the new pages, because everything new is route-lazy-loaded.
- Every migration file checked for balanced `$$` function-body delimiters (all even).
- Grepped for `localhost` — zero real references (one code comment mentions the word descriptively).
- Grepped for "Apple" — zero remaining references anywhere in `src/`.

## Explicitly deferred / not built this round (flagging honestly rather than skipping silently)
- **Interactive Africa map with per-country member data** — the existing `AfricaNetworkMap` component is decorative (glowing nodes, not tied to real per-country membership counts). Building a genuinely data-driven version (real member counts per country, easy to extend) is a distinct, sizable piece of work I haven't started.
- **"Why Africa Matters" / "Builders Across Africa" homepage sections** — not built. These would need either real illustrated content or additional real data sources; adding them as copy-only placeholder sections felt lower value than the features actually built this round.
- **Testimonials section** — deliberately not built, since real testimonials don't exist yet and fabricating quotes would violate the "never invent content" standard this whole project has held to.
- **Daily-activity XP** ("Award XP for... Daily activity") — not implemented; awarding this safely needs a once-per-day dedupe mechanism (e.g., a `last_xp_claim_date` column checked server-side) that I didn't get to. Currently XP comes from referrals, bounty applications, submission approval, and one-time profile completion.
- **Duplicate-submission prevention** — already covered from a prior round (`apply_to_bounty()` checks for an existing application before inserting), not new this round, but confirming it's in place since the brief re-requested it.
- Full manual QA in an actual browser (the "✅ Final QA" checklist) — I verified everything that a build/type-check/grep pass can catch. I don't have a browser in this environment, so things like "does the Google button actually complete an OAuth round-trip" need a real click-through on your end after deploying.
