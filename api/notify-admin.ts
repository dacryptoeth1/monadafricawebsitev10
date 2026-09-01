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
//   ADMIN_NOTIFY_EMAIL        e.g. "bd@monadafrica.xyz" — where these land
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

// Normalized shape both branches below populate — only the fields this
// function actually reads out of either source table.
interface NotifyRow {
  id: string
  created_by: string
  project_name: string | null
  contact_person: string | null
  contact_email: string | null
  partnership_type: string | null
  title: string | null
  total_reward: string | null
  reward_currency: string | null
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
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const notifyEmail = process.env.ADMIN_NOTIFY_EMAIL

  if (!supabaseUrl || !serviceKey) {
    console.error('notify-admin: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
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
  const columns = isPartnership
    ? 'id,created_by,project_name,contact_person,contact_email,partnership_type'
    : 'id,created_by,project_name,title,contact_person,contact_email,total_reward,reward_currency'
  const restResp = await fetch(
    `${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(entity_id)}&select=${columns}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  )
  const rows = restResp.ok ? ((await restResp.json().catch(() => [])) as Partial<NotifyRow>[]) : []
  const found = rows[0]
  const row: NotifyRow | null = found
    ? {
        id: found.id!,
        created_by: found.created_by!,
        project_name: found.project_name ?? null,
        contact_person: found.contact_person ?? null,
        contact_email: found.contact_email ?? null,
        partnership_type: isPartnership ? (found.partnership_type ?? null) : null,
        title: !isPartnership ? (found.title ?? null) : null,
        total_reward: !isPartnership ? (found.total_reward ?? null) : null,
        reward_currency: !isPartnership ? (found.reward_currency ?? null) : null,
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
    ? `New partnership application — ${row.project_name}`
    : `New bounty hosting request — ${row.title || row.project_name}`
  const reviewTab = isPartnership ? 'Partnerships' : 'Bounty Requests'

  const html = `
  <div style="background:#07050A;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#0F0B16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:28px 32px;">
      <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#A99AFF;font-weight:600;">Monad Africa Admin</div>
      <h1 style="font-size:20px;color:#ffffff;margin:12px 0 16px 0;">${escapeHtml(subject)}</h1>
      <div style="color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;">
        <div><strong style="color:#fff;">Project:</strong> ${escapeHtml(row.project_name || '—')}</div>
        <div><strong style="color:#fff;">Contact:</strong> ${escapeHtml(row.contact_person || '—')} (${escapeHtml(row.contact_email || '—')})</div>
        ${isPartnership ? `<div><strong style="color:#fff;">Type:</strong> ${escapeHtml(row.partnership_type || '—')}</div>` : ''}
        ${!isPartnership ? `<div><strong style="color:#fff;">Reward:</strong> ${escapeHtml(row.total_reward || '—')} ${escapeHtml(row.reward_currency || '')}</div>` : ''}
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
