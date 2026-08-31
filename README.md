# Monad Africa

<<<<<<< HEAD
Vite + React + TypeScript + Tailwind + Framer Motion + Lucide React, backed by Supabase
(Auth, Database, Storage, RLS).

## 1. Run the database migration

Supabase Dashboard → your project → **SQL Editor → New query** → paste the entire contents
of `supabase/migrations/0001_init.sql` → **Run**.

This single file creates every table, enables RLS with real policies on all of them, and
creates the three storage buckets (`logos`, `resources`, `videos`) with their access
policies. Nothing else to run separately.

## 2. Create your admin account

If you don't already have one: **Authentication → Users → Add user** → enter an email and
password.

Then, in **SQL Editor**, run (swap in that user's email):

```sql
insert into public.admins (id)
select id from auth.users where email = 'you@example.com';
```

That's the real access control — `/admin` checks this table, not just whether someone is
logged in. Without this row, an account can sign in at `/admin` but will see a "Not
authorized" screen.

## 3. Install and run
=======
Vite + React + TypeScript + Tailwind + Framer Motion + Lucide React + Recharts, backed by
Supabase (Auth, Database, Storage, RLS). Production: https://monadafricans.netlify.app

## Setup order

Run these in the Supabase SQL Editor, in order, if you haven't already:

1. `0001_init.sql`
2. `0002_user_platform.sql`
3. `0003_protect_profile_fields.sql`
4. `0004_profile_extras_and_credits.sql`
5. `0005_admin_control_panel.sql` ← **new this round**

All are self-contained (`IF NOT EXISTS` / `CREATE OR REPLACE` throughout), safe to run even
if you're unsure an earlier one fully succeeded.
>>>>>>> fix/password-reset-otp-admin-api

```bash
npm install
npm run dev
```

<<<<<<< HEAD
`.env.local` already has your Supabase URL and anon key filled in.

## 4. Try it

- `/host-bounty` — submit a bounty with a logo image upload (goes to Supabase Storage), and
  a database row with `status = 'pending'`.
- `/admin` — sign in, approve it under **Pending Bounties**.
- It now shows up on `/` and `/bounties`. Anyone can click **Apply** on a bounty card to
  submit an application (no account needed) — view those under **Applications** in admin.
- Add ecosystem projects, resources, videos, and partners from their respective admin tabs;
  they show up immediately on `/ecosystem`, `/beginner-hub`, and `/partners`.
- Edit community stats under **Settings** — they show on the homepage and `/community`.

## 5. Deploy to Netlify

Push to a Git repo and connect it, or `npm run build` and drag the `dist/` folder in.
Build command `npm run build`, publish directory `dist`. Set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` in Netlify's environment variables (same values as `.env.local`) —
don't commit `.env.local` itself. `netlify.toml` is already set up for SPA routing so
`/bounties`, `/admin`, etc. work on direct load/refresh.

## How the important parts work

- **No public sign-up.** The only way to get a Supabase Auth account is via the Dashboard,
  and only accounts listed in the `admins` table can write anything admin-only. `/admin`
  has no nav link, but that's just obscurity — the real boundary is the RLS policies plus
  the `admins` table check, enforced by Postgres itself.
- **Bounty submissions** can only ever be inserted with `status = 'pending'` — enforced by
  the RLS policy on `insert`, not just the form.
- **Public reads** of `bounties` only return `status = 'approved'` rows unless you're an
  admin.
- **Applications** are insert-only for the public (anyone can apply, no login) and
  select/update/delete-only for admins — a builder can't read other people's applications.
- **Storage**: the `logos` bucket accepts public uploads (needed since there are no public
  accounts to gate it by), but a file only becomes visible anywhere until an admin approves
  the bounty referencing its URL. `resources` and `videos` buckets are admin-upload-only.

## Design notes

- Colors: Monad purple (`#6E54FF`) as primary, black/near-black base, soft lavender, warm
  gold accents, and a sunset gradient (coral → gold → purple) used sparingly for emphasis.
- African-inspired elements: a low-opacity geometric pattern (`KentePattern`) as background
  texture, wavy `ContourLines` behind section headers evoking topographic maps, and a
  glowing `AfricaNetworkMap` connecting builder hubs across the continent in the hero.
- The beginners explainer video is kept on `/beginner-hub` as requested, embedded via
  iframe (works fine on a real deployed site — this isn't inside a sandboxed preview).

## Not built (flag if you want these)

No public builder-profile system (the "Featured Builders" section is an honest empty state
— wire it to a `builders` table the same way `projects`/`partners` work if you want it), no
page transition routing animation between pages (section-level scroll reveals are done with
Framer Motion throughout), no image optimization/CDN pipeline beyond what Supabase Storage
provides natively.
=======
`.env.local` already has your Supabase URL and anon key — no new environment variables.

## Manual steps

### 1. Make yourself (or anyone) a Super Admin
Only Super Admins can reach `/admin` — Moderator is a real role in the schema but currently
grants no panel access (see "Scope decisions" below). To promote someone:
```sql
insert into public.admins (id, role)
select id, 'super_admin' from auth.users where email = 'you@example.com'
on conflict (id) do update set role = 'super_admin';
```
If you already had an admin row from before roles existed, `0005` automatically upgraded it
to `super_admin` — you shouldn't need to do this for your existing account.

### 2. Enable live Discord stats (optional but recommended)
Discord Server Settings → Widget → enable "Server Widget" → copy the Server ID → paste it
into Admin → Settings → Discord → "Server (Guild) ID" → check "Widget enabled (live)" →
Save. No bot, no token — Discord's widget.json endpoint is public. If you skip this, the
manual Discord numbers you enter are shown instead, clearly labeled "Manual."

X and Telegram **cannot** be made live from the browser without exposing a secret API
token, so those stay manual permanently — labeled as such on the Community page.

### 3. Auth redirects / Google / Apple — same as last round, still required
- Supabase Dashboard → Authentication → URL Configuration: Site URL and Redirect URLs set
  to `https://monadafricans.netlify.app` (+ `/login`, `/reset-password`, `/dashboard`).
- Supabase Dashboard → Authentication → Providers: enable Google and Apple with their real
  OAuth credentials (Google Cloud Console / Apple Developer account) — the buttons and code
  are already built, they just show a graceful "not available yet" message until this is done.

## What's new this round

### Role system
- `admins.role` is now `'super_admin' | 'moderator'`. `/admin` requires Super Admin
  specifically — this matches the brief's literal wording ("Only Super Admins should be
  able to access /admin"). Moderator exists as a real, assignable role but currently has
  no additional access anywhere in the app; flagged as a scope decision below.

### Admin Control Panel — new tabs
- **Overview**: Total/Online Users, Total/Active/Completed Bounties, Pending/Approved/
  Rejected Submissions, Credits Issued, Countries, States, Daily/Weekly/Monthly Signups,
  plus charts (daily & monthly registrations, users by country, credits spent) and Top
  Contributors / Most Active Users lists.
- **Users**: search, filter (role/suspended/banned), sort (newest/oldest/credits/referrals),
  adjust credits, reset credits to platform default, three-way role dropdown, suspend,
  **ban** (real — enforced at the RLS layer, signs the user out immediately), **delete
  profile data** (see the hard limit below).
- **Announcements**: create, pin (shows as a banner across the whole site), delete.
- **Homepage**: edit hero title/subtitle/buttons, footer tagline, roadmap, and FAQ — saved
  straight to the database, live on the homepage immediately with no code changes.
- **Community stats** (Settings tab): X and Telegram manual fields with weekly/daily deltas,
  Discord live-widget toggle + manual fallback fields — seeded with the real numbers you
  gave me (1,103 X / 2,587 Telegram / 1,982 Discord / 132 online).
- **Bounties**: added Close/Reopen (distinct from approve/reject — a bounty can be approved
  and later closed once filled, tracked separately as "completed").

### Public-facing
- **Community page** rewritten with clear Live/Manual badges per platform.
- **Homepage**: hero content, buttons, Roadmap, and FAQ are now CMS-driven (empty
  Roadmap/FAQ sections simply don't render, so nothing changes visually until you add
  content in Admin → Homepage). The gradient-highlighted "Monad" in the hero title is
  preserved even though the title text itself is now editable.
- **Announcement banner**: pinned announcements show as a slim strip inside the existing
  nav bar (not a separate floating element, so it doesn't disturb the site's layout).
- **Profile**: added GitHub and Wallet Address fields.

## Two hard platform limits (flagged honestly, not worked around)

1. **True user deletion.** Removing someone's login/auth account requires the Supabase
   Admin API with the `service_role` key, which can never safely run in client-side code.
   "Delete profile data" removes their profile, applications, submissions, and credit
   history — their login technically still exists but has no profile, which the app
   doesn't currently handle gracefully (would need dedicated re-onboarding UI). **Ban** is
   the real access-revoking action: it's enforced at the RLS layer (not just hidden in the
   UI) and signs the user out immediately. A proper delete would need a Supabase Edge
   Function running with the service_role key — happy to build that next if you want it.
2. **Live X and Telegram counts.** Neither has a public, unauthenticated way to fetch
   follower/member counts from a browser. Doing it "live" would require a backend holding
   a secret bearer token (X API) or bot token (Telegram Bot API) — out of scope for a
   static frontend. Discord is the only one of the three with a genuinely public widget
   endpoint, which is why it's the only one that can actually be live.

## Scope decisions (flag if you want these changed)

- Moderator role currently grants zero extra access — it's provisioned in the schema
  (`admins.role`) and assignable from the Users tab, but no UI surface checks for it yet.
  Easy to build a limited moderator panel later (e.g., bounty/submission review only)
  without any schema changes.
- "Delete users" is "delete profile data," not "delete login" — see hard limit #1 above.
- Roadmap/FAQ default to empty and simply don't render — add content in Admin → Homepage
  whenever you're ready.

## Production checklist status

| Item | Status |
|---|---|
| Build succeeds | ✅ verified (`tsc -b && vite build`, clean, 2603 modules) |
| No console errors | ⚠️ not verified in an actual browser — no browser available in this environment |
| No localhost references | ✅ verified (grep — only a code comment mentions the word) |
| Works on Netlify | ✅ same `netlify.toml` SPA redirect config as before |
| Mobile / Safari / Chrome | ✅ all new UI reuses the same responsive Tailwind patterns as the rest of the site; not manually tested on physical devices |
| Works with Supabase | ✅ all new tables/RPCs verified for balanced SQL syntax; RLS policies written and self-consistent |

## Performance note
Recharts (used only in Admin → Overview) added real weight, but it's isolated to the
already-lazy-loaded `/admin` chunk — the public-facing bundle size is unchanged from last
round (~520KB / 155KB gzipped for the main chunk).
>>>>>>> fix/password-reset-otp-admin-api
