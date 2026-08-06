# Monad Africa

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

```bash
npm install
npm run dev
```

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
