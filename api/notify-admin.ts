// Vercel serverless function (Node.js runtime, zero-config under /api) —
// replaces netlify/functions/notify-admin.ts now that Vercel is the
// actual deployment platform (there is no equivalent Netlify Functions
// runtime running in production here). Same job: email the Monad
// Africa admin/BD team whenever a new partnership application or
// bounty hosting request comes in. There is no in-app admin inbox
// (public.notifications is user-facing only — see the header comment
// in supabase/migrations/0002), so this is the "notify the admin and
// BD team" channel from the spec, alongside the pending-count badges
// already shown on the relevant admin tabs.
//
// All secrets (SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
// ADMIN_NOTIFY_EMAIL) are read from process.env — server-side only,
// never bundled into the Vite client build and never committed to the
// repo (kept out of .env.example, set directly in Vercel's project env
// vars). The client (src/lib/notifyAdmin.ts) only ever sends the
// caller's own Supabase access token + the entity it just created; it
// never sees or needs any of these values.
//
// Required env vars (Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL
//   ADMIN_NOTIFY_EMAIL        where these land — set to africamonad@gmail.com
// Optional:
//   SITE_URL                 defaults to the production site origin below
//
// Deliberately talks to Supabase's Auth/PostgREST HTTP APIs directly via
// fetch() instead of the @supabase/supabase-js client: confirmed while
// testing this locally that createClient() throws synchronously on
// Node <22 ("Node.js detected but native WebSocket not found") — its
// constructor unconditionally spins up a realtime client, which this
// function never uses. Two plain REST calls sidestep that dependency
// entirely and work the same on every Node runtime version.

type EntityType = 'partnership_application' | 'bounty_hosting_request'

interface RequestBody {
  entity_type?: EntityType
  entity_id?: string
}

// Normalized shape both branches below populate — a superset of every
// field either table has that the destination email should include;
// each branch leaves the fields that don't apply to it as null.
interface NotifyRow {
  id: string
  created_by: string
  created_at: string | null
  project_name: string | null
  contact_person: string | null
  contact_email: string | null
  website: string | null
  x_username: string | null
  telegram: string | null
  // Partnership-only
  partnership_type: string | null
  proposal_message: string | null
  project_description: string | null
  additional_links: string | null
  // Bounty-only
  title: string | null
  description: string | null
  category: string | null
  required_skills: string | null
  total_reward: string | null
  reward_currency: string | null
  submission_deadline: string | null
  relevant_links: string | null
}

// Minimal structural types for the Vercel Node.js request/response —
// hand-rolled (matching this repo's existing netlify/functions/*.ts
// convention of not pulling in the platform's own types package) rather
// than depending on @vercel/node, which isn't otherwise needed here:
// Vercel's Node runtime parses a JSON request body into req.body for us
// and augments the response with .status()/.json() at runtime.
interface VercelReq {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}
interface VercelRes {
  status(code: number): VercelRes
  json(body: unknown): void
}

const SITE_URL = process.env.SITE_URL || 'https://monadafricawebsitev10.vercel.app'

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  // Top-level error boundary: a transient failure calling Supabase or
  // Resend (network blip, DNS, timeout) must still come back as clean
  // JSON, not an unhandled crash — confirmed against a real invocation
  // while testing this locally via `vercel dev`.
  try {
    await handlePost(req, res)
  } catch (err) {
    console.error('notify-admin: unexpected failure:', err)
    res.status(500).json({ ok: false, error: 'internal_error' })
  }
}

async function handlePost(req: VercelReq, res: VercelRes) {
  // Falls back to VITE_SUPABASE_URL if the bare SUPABASE_URL isn't set
  // as its own Vercel env var — confirmed via `vercel env ls` that only
  // VITE_SUPABASE_URL currently exists at the project level (no bare
  // SUPABASE_URL row), which would make every call here fail at this
  // exact check with "server_not_configured". VITE_SUPABASE_URL is
  // already public (it ships in the client bundle), so reading it
  // server-side here isn't a secret-exposure risk — it's the same
  // project URL either way, just read under a different variable name.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL

  if (!supabaseUrl || !serviceKey) {
    console.error('notify-admin: missing SUPABASE_URL (and VITE_SUPABASE_URL fallback) / SUPABASE_SERVICE_ROLE_KEY')
    res.status(500).json({ ok: false, error: 'server_not_configured' })
    return
  }

  // Vercel's Node runtime already parses a JSON body for us (unlike
  // Netlify Functions, which hand back a raw string) — but guard
  // against a string body too, in case Content-Type wasn't set.
  let payload: RequestBody
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : ((req.body as RequestBody) ?? {})
  } catch {
    res.status(400).json({ ok: false, error: 'invalid_json' })
    return
  }

  const { entity_type, entity_id } = payload
  if (entity_type !== 'partnership_application' && entity_type !== 'bounty_hosting_request') {
    res.status(400).json({ ok: false, error: 'invalid_entity_type' })
    return
  }
  if (!entity_id) {
    res.status(400).json({ ok: false, error: 'missing_entity_id' })
    return
  }

  // Only the signed-in owner of the row (right after their own submit)
  // may trigger this — never an unauthenticated caller, and never for
  // someone else's application.
  const authHeaderRaw = req.headers.authorization ?? req.headers.Authorization
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'missing_token' })
    return
  }

  // 1. Verify the bearer token belongs to a real, current Supabase user
  // — GoTrue validates the JWT itself and returns the user object
  // directly (200) or an error (401/403) on an invalid/expired token.
  const token = authHeader.slice('Bearer '.length)
  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  })
  if (!userResp.ok) {
    res.status(401).json({ ok: false, error: 'invalid_token' })
    return
  }
  const user = (await userResp.json().catch(() => null)) as { id?: string } | null
  if (!user?.id) {
    res.status(401).json({ ok: false, error: 'invalid_token' })
    return
  }

  // 2. Re-fetch the row server-side (never trust the client's own
  // description of it) via PostgREST, using the service role to bypass
  // RLS the same way createClient(...).from(...) would have.
  const isPartnership = entity_type === 'partnership_application'
  const table = isPartnership ? 'partnership_applications' : 'bounty_hosting_requests'
  // additional_info is reused as "Project description" and description
  // as "Proposal / Message" for a partnership_applications row — see
  // Partners.tsx's own field-mapping comment for why (no schema change
  // needed: both are already-existing nullable free-text columns).
  const columns = isPartnership
    ? 'id,created_by,created_at,project_name,contact_person,contact_email,website,x_username,telegram,partnership_type,description,additional_info,supporting_links'
    : 'id,created_by,created_at,project_name,contact_person,contact_email,website,x_username,telegram,title,description,category,required_skills,total_reward,reward_currency,submission_deadline,relevant_links'
  const restResp = await fetch(
    `${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(entity_id)}&select=${columns}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  )
  const dbRows = restResp.ok ? ((await restResp.json().catch(() => [])) as Record<string, unknown>[]) : []
  const found = dbRows[0] as Partial<{
    id: string; created_by: string; created_at: string; project_name: string; contact_person: string
    contact_email: string; website: string; x_username: string; telegram: string; partnership_type: string
    description: string; additional_info: string; supporting_links: string; title: string; category: string
    required_skills: string; total_reward: string; reward_currency: string; submission_deadline: string; relevant_links: string
  }> | undefined
  const row: NotifyRow | null = found
    ? {
        id: found.id!,
        created_by: found.created_by!,
        created_at: found.created_at ?? null,
        project_name: found.project_name ?? null,
        contact_person: found.contact_person ?? null,
        contact_email: found.contact_email ?? null,
        website: found.website ?? null,
        x_username: found.x_username ?? null,
        telegram: found.telegram ?? null,
        partnership_type: isPartnership ? (found.partnership_type ?? null) : null,
        proposal_message: isPartnership ? (found.description ?? null) : null,
        project_description: isPartnership ? (found.additional_info ?? null) : null,
        additional_links: isPartnership ? (found.supporting_links ?? null) : null,
        title: !isPartnership ? (found.title ?? null) : null,
        description: !isPartnership ? (found.description ?? null) : null,
        category: !isPartnership ? (found.category ?? null) : null,
        required_skills: !isPartnership ? (found.required_skills ?? null) : null,
        total_reward: !isPartnership ? (found.total_reward ?? null) : null,
        reward_currency: !isPartnership ? (found.reward_currency ?? null) : null,
        submission_deadline: !isPartnership ? (found.submission_deadline ?? null) : null,
        relevant_links: !isPartnership ? (found.relevant_links ?? null) : null,
      }
    : null

  if (!row || row.created_by !== user.id) {
    res.status(404).json({ ok: false, error: 'not_found' })
    return
  }

  if (!resendKey || !fromEmail || !notifyEmail) {
    console.error('notify-admin: missing RESEND_API_KEY / RESEND_FROM_EMAIL / ADMIN_NOTIFY_EMAIL')
    res.status(200).json({ ok: false, error: 'email_not_configured' })
    return
  }

  const subject = isPartnership
    ? `New Monad Africa Partnership Proposal — ${row.project_name || 'Untitled'}`
    : `New Monad Africa Bounty Submission — ${row.title || row.project_name || 'Untitled'}`
  const reviewTab = isPartnership ? 'Partnerships' : 'Bounty Requests'
  const submittedAt = row.created_at
    ? new Date(row.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC'
    : '—'

  // One row per field, only when it has a real value — never a blank
  // "Category: —" line cluttering the email for an optional field
  // nobody filled in.
  const rows: [string, string | null][] = isPartnership
    ? [
        ['Full Name', row.contact_person],
        ['Email', row.contact_email],
        ['Project / Organization', row.project_name],
        ['X / Twitter', row.x_username],
        ['Partnership Type', row.partnership_type],
        ['Website', row.website],
        ['Telegram / Discord', row.telegram],
        ['Project Description', row.project_description],
        ['Additional Links', row.additional_links],
        ['Proposal / Message', row.proposal_message],
        ['Submitted', submittedAt],
      ]
    : [
        ['Submitter Name', row.contact_person],
        ['Email', row.contact_email],
        ['Project Name', row.project_name],
        ['Bounty Title', row.title],
        ['Category', row.category],
        ['Reward', [row.total_reward, row.reward_currency].filter(Boolean).join(' ') || null],
        ['Deadline', row.submission_deadline],
        ['Requirements', row.required_skills],
        ['Website', row.website],
        ['X / Twitter', row.x_username],
        ['Telegram / Discord', row.telegram],
        ['Links', row.relevant_links],
        ['Description', row.description],
        ['Submitted', submittedAt],
      ]

  const rowsHtml = rows
    .filter(([, value]) => value)
    .map(([label, value]) => `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><strong style="color:#fff;">${escapeHtml(label)}:</strong> ${escapeHtml(String(value)).replace(/\n/g, '<br/>')}</div>`)
    .join('')

  const html = `
  <div style="background:#07050A;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#0F0B16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:28px 32px;">
      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#A99AFF;font-weight:600;">Monad Africa</div>
      <h1 style="font-size:19px;color:#ffffff;margin:12px 0 16px 0;line-height:1.4;">${escapeHtml(subject)}</h1>
      <div style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.7;">
        ${rowsHtml}
      </div>
      <a href="${SITE_URL}/admin" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#6E54FF;color:#fff;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600;">
        Review in Admin Dashboard →
      </a>
      <p style="color:rgba(255,255,255,0.3);font-size:11px;margin-top:20px;">Open the "${reviewTab}" tab to respond.</p>
    </div>
  </div>`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [notifyEmail], subject, html }),
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText)
      console.error('notify-admin: Resend send failed:', errText)
      res.status(200).json({ ok: false, error: 'send_failed' })
      return
    }
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('notify-admin: send failed:', err)
    res.status(200).json({ ok: false, error: 'send_failed' })
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
