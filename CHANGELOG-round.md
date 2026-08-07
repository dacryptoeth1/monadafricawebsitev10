# CHANGELOG — Admin Dashboard Verification + Gap Fixes

## Important context
The Admin Dashboard was not missing — `src/pages/admin/AdminDashboard.tsx` (882 lines,
12 supporting panel files) has existed and been routed at `/admin` since several rounds ago.
A search for the literal string "Admin Dashboard" (with a space) wouldn't match the actual
component name `AdminDashboard` (no space), which is the most likely explanation. Rather
than rebuild it from scratch — which risked creating duplicate, conflicting code and
violated the standing "do not rebuild" instruction — I verified the existing implementation
against every requirement in your message line by line, and only built what was genuinely
missing. Four real gaps turned up; everything else in your list was already there.

## New database migration
- `supabase/migrations/0011_reset_xp.sql` — adds `admin_reset_xp()`. "Reset XP" was the one
  Credits/XP action from your list that didn't exist yet (Add/Remove XP did).

## What was actually fixed/added this round

1. Redirect behavior on `/admin` — previously, a signed-in non-admin saw a "Not authorized"
   explanation page. Your spec asks for a silent redirect to the homepage instead. Changed
   to `<Navigate to="/" replace />`. Signed-out visitors still see a login form rather than
   being redirected, since that's the legitimate path for staff who haven't logged in yet —
   only authenticated non-admins get redirected home.
2. Reset XP — new migration plus a "Reset XP" button next to the existing "Reset credits"
   button in the Users panel (Admin+ only, same as credit reset).
3. View Profile — new "View Profile" button on every user row, opens a modal with avatar,
   bio, country/region, role, credits, XP, referrals, referral code, social links, and
   wallet address. This didn't exist before; the Users panel only showed a one-line summary.
4. Two missing Overview cards — "Community Members" (sum of Discord + Telegram + X, from the
   existing site_settings numbers) and "XP Awarded" (total positive XP transactions,
   mirroring how Credits Issued was already computed). Both were in your explicit card list
   but not in the Overview tab.

## Everything else you listed — already built, verified present
- Admin nav button, /admin route protection, role-based access at both the UI and RLS
  layer — from a prior round.
- All ten dashboard sections you named (Overview, Users, Credits, XP, Leaderboard, Bounties,
  Submissions, Announcements, Homepage Stats, Settings) exist as real tabs.
- Users: search, filter, sort, promote, demote, suspend, ban, delete — all present.
- Role management (User to Moderator to Admin) — the Roles tab and the per-user role
  dropdown in Users both call the same admin_set_role() RPC.
- Credits: add, remove, reset, full history — all present (reset was the only gap, now
  fixed).
- Bounties: create, edit, delete, feature, close, reopen — all present.
- Homepage Stats: Community Members, Registered Users, Active Builders, Countries, Discord
  Members, Telegram Members, X Followers — all editable in the Settings tab, save instantly.
- Security: every admin RPC checks the caller's tier server-side (not just the UI), so a
  normal user calling the API directly gets rejected regardless of what the frontend shows.

## Files changed
- src/components/AdminRoute.tsx — redirect-to-homepage behavior
- src/pages/admin/AdminDashboard.tsx — Reset XP + View Profile (button, modal, state)
- src/pages/admin/AdminOverview.tsx — Community Members + XP Awarded cards

## New dependency
None.

## Manual Supabase steps
Run 0011_reset_xp.sql.

## Manual Netlify steps
None new.

## Verified before returning
- tsc -b — clean.
- vite build — clean, main bundle unchanged, admin chunk grew about 3KB for the new modal.
- Migration checked for balanced $$ delimiters.
- Grepped for localhost — zero real references.

## If you're still not seeing the dashboard after this
Please tell me exactly what you're searching (the zip file, a deployed Netlify build, or
your own repo) and what search tool/term you're using — that'll tell us definitively whether
this is a stale-download issue, a deployment that hasn't picked up recent changes, or
something I'm genuinely missing that a code-only audit from here can't catch (like a browser
console error only visible after deploying, since I don't have a live browser in this
environment).
