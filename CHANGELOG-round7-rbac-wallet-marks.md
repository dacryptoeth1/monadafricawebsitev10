# CHANGELOG — Role-tiered Admin, Rank System, Wallet Connect, Brand Mark

## New database migration
- **`supabase/migrations/0007_role_tiers_and_wallet.sql`** — run after 0001-0006.

### What it fixes/adds
- **The important one first**: a real security gap. Several admin RPCs (`admin_set_suspended`, `admin_set_banned`, `admin_delete_profile_data`, `admin_reset_credits`) were checking `is_admin()` — true for *any* staff tier including Moderator. This round's brief explicitly restricts Moderators to reviewing submissions and awarding XP/credits, nothing more. Added `is_staff_admin()` (Admin/Super Admin only, excludes Moderator) and re-created those four functions to require it. `admin_set_role()` re-created so granting/changing `super_admin` specifically requires already being a Super Admin (prevents an Admin from minting peer Admins). `admin_adjust_credits`, `admin_award_xp`, `admin_approve_submission` were already correctly open to Moderators — unchanged.
- `profiles.wallet_provider` — records *which* wallet was connected (MetaMask/Rabby/Backpack/Phantom), not just the address.

## New dependency
None — Wallet Connect uses the browser-native EIP-6963 event standard, no SDK/API key/project ID required.

## Files changed

### Admin RBAC (the architectural fix)
- **`src/components/AdminRoute.tsx`** — reopened to any staff tier (Moderator/Admin/Super Admin). It was Super-Admin-only from an earlier round; that was correct for that round's spec, but this round explicitly requires a working Moderator Panel. Real enforcement now lives in the database (see migration above), not the route gate.
- **`src/pages/admin/AdminDashboard.tsx`**:
  - Tabs are now role-filtered: Moderators see **Submissions, Applications, Users** only. Overview, bounty creation/editing, content management (Projects/Resources/Videos/Partners/Events/News/Announcements), Homepage, and Settings are Admin+ only.
  - Users panel: Moderators keep credit/XP award buttons and the new **History** button; Reset Credits, Make/Remove Ambassador, role-change dropdown, Suspend, Ban, Delete Data, and Export CSV are hidden unless `isStaffAdmin`.
  - Added a **per-user Credit + XP history modal** ("View credit history" / "View XP history" from the brief).
  - Added **Feature/Unfeature** toggle on approved bounties (`bounties.is_featured`, column already existed from a prior round, no UI toggle until now).
  - A safety `useEffect` forces a Moderator off any staff-only tab if their role changes mid-session (e.g., demoted while the dashboard is open).

### Rank system
- **`src/lib/rank.ts`** *(new)* — single source of truth for the exact thresholds from the brief: 0=Rookie, 100=Contributor, 300=Builder, 700=Expert, 1500=Ambassador, 3000=Legend. `getRank(xp)` and `getNextRank(xp)` exported.
- Wired into **`Leaderboard.tsx`** (shows country + rank tier per row), **`ProfileStatsHeader.tsx`**, and **`Dashboard.tsx`**. Along the way, split what used to be a single ambiguous "Rank" stat (which was actually numeric leaderboard position) into two distinct stats: **Rank** (the tier name, e.g. "Builder") and **Position** (numeric, e.g. "#12") — the brief asks for both on the profile and leaderboard, and they'd been conflated.

### Wallet Connect
- **`src/components/WalletConnect.tsx`** *(new)* — real (not stubbed) multi-wallet detection via the EIP-6963 "Multi Injected Provider Discovery" browser standard. Listens for `eip6963:announceProvider` events; MetaMask, Rabby, Backpack, and Phantom (in EVM mode) all announce themselves this way when installed as extensions. Clicking a detected wallet calls `eth_requestAccounts` and saves the returned address + wallet name. Falls back to the existing manual-entry text field (still regex-validated) if no wallet is detected, or if the user prefers to just paste an address.
- **`src/pages/Profile.tsx`** — wallet field converted from an uncontrolled form input to controlled state so Wallet Connect can populate it; saves both `wallet_address` and `wallet_provider`.

### Brand mark
- **`src/components/MonadMark.tsx`** *(new)* — single shared component for the purple-gradient "M" monogram already established in the navbar. **This is our own mark, not Monad's official logo file** — none was ever provided in this conversation to build with. If you have the real logo asset (SVG ideally), it's a one-line swap inside this single file to update it everywhere at once.
- Added to: navbar (replaced the old inline span with this shared component), Hero, Footer, Login, Signup, Dashboard header, Admin Dashboard header, and the app-wide Suspense loading screen (`App.tsx` — was plain "Loading…" text, now a pulsing branded mark).

## Manual Supabase steps required
1. Run `0007_role_tiers_and_wallet.sql` (after 0001-0006).
2. If you have Moderators already assigned from a prior round, no action needed — their access automatically narrows to the new, correct scope once this migration runs.

## Manual Netlify steps required
None new.

## Verified before returning
- `tsc -b` — clean.
- `vite build` — clean, 2610 modules. Main bundle ~523KB / 155KB gzipped, essentially unchanged despite everything added this round (Wallet Connect and the rank utility are both tiny; MonadMark is trivial).
- All 7 migration files checked for balanced `$$` function-body delimiters.
- Grepped for `localhost` — zero real references.

## Explicitly deferred / not built this round
- **Sandbox / Test Mode** (fake users, fake submissions, reset testing data) — flagging a real architectural conflict rather than working around it: `profiles.id` has a foreign key to `auth.users(id)`. Client-side code cannot create `auth.users` rows (that needs the Supabase Admin API + `service_role`, same limitation noted for account deletion in earlier rounds), so "fake users" can't exist without either (a) a backend/Edge Function that creates real (if clearly-labeled test) auth accounts, or (b) relaxing the foreign key to allow synthetic profile rows not backed by real logins, which has its own risks (those rows would break anything that joins through `auth.users`, like email display). This needs a design decision from you before I build it either way.
- **Dynamic bounty categories** — `bounties.category` is still a fixed `CHECK` constraint enum (Development/Design/Marketing/Community/Content), not an admin-managed table. Brief asks for "Manage categories"; turning this into a real dynamic table is a moderate schema change I didn't get to.
- **Reports system** ("Moderators can... View reports") — no reporting mechanism (e.g., users flagging a bad bounty or submission) exists yet. Net-new feature, not started.
- **Deep performance/Lighthouse work** — I did what's verifiable from this environment (route-level lazy loading, kept the main bundle flat despite new features). Actual Lighthouse scoring, real-device iPhone/Android testing, and React re-render profiling all need a real browser, which I don't have access to here.
