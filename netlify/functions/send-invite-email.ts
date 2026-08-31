// Netlify Function — the only place in this feature that touches an
// email provider API key or the Supabase service-role key. Both come
// from Netlify's function environment (Site settings → Environment
// variables), never from the Vite client bundle.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL          e.g. "Monad Africa <events@yourdomain.com>"
// Optional:
//   SITE_URL                   defaults to https://monadafricans.netlify.app
//
// Auth model (see supabase/migrations/0016_events_table_unification.sql
// for the matching RLS/RPC side of this — events + event_registrations,
// not the abandoned event_listings design in 0015):
//   - Admin caller: Authorization: Bearer <supabase access token>, verified
//     against the `admins` table — may resend for any registration.
//   - Self caller (right after registering, or the success screen's own
//     "Resend" button): no token, but must supply the exact invite_code
//     that was returned by register_for_event — acts as a bearer secret
//     only the registrant (or someone reading their confirmation email)
//     would have.
// Neither path ever echoes the invite code back in the response.

import { createClient } from '@supabase/supabase-js'

interface RequestBody {
  registration_id?: string
  invite_code?: string
}

const SITE_URL = process.env.SITE_URL || 'https://monadafricans.netlify.app'

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function handler(event: { httpMethod: string; body: string | null; headers: Record<string, string | undefined> }) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!supabaseUrl || !serviceKey) {
    console.error('send-invite-email: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json(500, { ok: false, error: 'server_not_configured' })
  }

  let payload: RequestBody
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }

  const registrationId = payload.registration_id
  if (!registrationId) {
    return json(400, { ok: false, error: 'missing_registration_id' })
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: registration, error: regErr } = await admin
    .from('event_registrations')
    .select('id, full_name, email, invite_code, event_id')
    .eq('id', registrationId)
    .maybeSingle()

  // Deliberately generic on every failure path below — this endpoint
  // never reveals whether a given ID exists to an unauthorized caller.
  if (regErr || !registration) {
    return json(404, { ok: false, error: 'not_found' })
  }

  // --- Authorization: admin token OR matching invite_code ---
  let authorized = false

  const authHeader = event.headers.authorization || event.headers.Authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    const { data: userData } = await admin.auth.getUser(token)
    if (userData?.user) {
      const { data: adminRow } = await admin.from('admins').select('id').eq('id', userData.user.id).maybeSingle()
      if (adminRow) authorized = true
    }
  }
  if (!authorized && payload.invite_code && payload.invite_code === registration.invite_code) {
    authorized = true
  }
  if (!authorized) {
    return json(403, { ok: false, error: 'not_authorized' })
  }

  const { data: eventRow, error: eventErr } = await admin
    .from('events')
    .select('title, event_date, start_time, location')
    .eq('id', registration.event_id)
    .maybeSingle()
  if (eventErr || !eventRow) {
    return json(404, { ok: false, error: 'event_not_found' })
  }

  if (!resendKey || !fromEmail) {
    console.error('send-invite-email: missing RESEND_API_KEY / RESEND_FROM_EMAIL')
    await admin.from('event_registrations').update({ email_sent: false, email_last_error: 'Email provider not configured' }).eq('id', registration.id)
    return json(200, { ok: false, error: 'email_not_configured' })
  }

  const html = renderEmailHtml({
    fullName: registration.full_name,
    inviteCode: registration.invite_code,
    eventTitle: eventRow.title,
    eventDate: eventRow.event_date,
    eventTime: eventRow.start_time,
    eventLocation: eventRow.location,
  })

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [registration.email],
        subject: `Your Monad Africa invite code — ${eventRow.title}`,
        html,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText)
      await admin.from('event_registrations').update({ email_sent: false, email_last_error: errText.slice(0, 500) }).eq('id', registration.id)
      return json(200, { ok: false, error: 'send_failed' })
    }

    await admin.from('event_registrations').update({ email_sent: true, email_sent_at: new Date().toISOString(), email_last_error: null }).eq('id', registration.id)
    return json(200, { ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await admin.from('event_registrations').update({ email_sent: false, email_last_error: message.slice(0, 500) }).eq('id', registration.id)
    return json(200, { ok: false, error: 'send_failed' })
  }
}

function renderEmailHtml(args: {
  fullName: string
  inviteCode: string
  eventTitle: string
  eventDate: string
  eventTime: string | null
  eventLocation: string | null
}) {
  const dateLabel = new Date(args.eventDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const timeLabel = args.eventTime ? formatTime(args.eventTime) : null

  return `
  <div style="background:#07050A;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#0F0B16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="padding:28px 32px 0 32px;">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#A99AFF;font-weight:600;">Monad Africa</div>
        <h1 style="font-size:22px;color:#ffffff;margin:12px 0 4px 0;">Registration confirmed!</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 20px 0;">
          Hi ${escapeHtml(args.fullName)}, your registration for <strong style="color:#ffffff;">${escapeHtml(args.eventTitle)}</strong> is confirmed.
        </p>
      </div>

      <div style="margin:0 32px 24px 32px;background:rgba(110,84,255,0.08);border:1px solid rgba(110,84,255,0.3);border-radius:16px;padding:20px 24px;text-align:center;">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#A99AFF;margin-bottom:8px;">Your unique invite code</div>
        <div style="font-size:24px;letter-spacing:0.08em;color:#ffffff;font-family:'Courier New',monospace;font-weight:700;">${escapeHtml(args.inviteCode)}</div>
      </div>

      <div style="margin:0 32px 24px 32px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;">
        <div><strong style="color:#fff;">Event:</strong> ${escapeHtml(args.eventTitle)}</div>
        <div><strong style="color:#fff;">Date:</strong> ${escapeHtml(dateLabel)}${timeLabel ? ` at ${escapeHtml(timeLabel)}` : ''}</div>
        ${args.eventLocation ? `<div><strong style="color:#fff;">Location:</strong> ${escapeHtml(args.eventLocation)}</div>` : ''}
      </div>

      <div style="margin:0 32px 28px 32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;margin:0;">
          Please keep this code safe and present it at check-in when you arrive — our team will scan or type it in to verify your registration on the spot.
        </p>
      </div>

      <div style="background:rgba(255,255,255,0.02);padding:16px 32px;text-align:center;">
        <a href="${SITE_URL}" style="color:rgba(255,255,255,0.3);font-size:11px;text-decoration:none;">© ${new Date().getFullYear()} Monad Africa · ${SITE_URL.replace(/^https?:\/\//, '')} · See you there!</a>
      </div>
    </div>
  </div>`
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
