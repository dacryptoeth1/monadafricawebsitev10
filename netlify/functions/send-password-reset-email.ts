// Netlify Function — the only place this feature touches the Resend API
// key or the Supabase service-role key. Both come from Netlify's
// function environment (Site settings → Environment variables), never
// from the Vite client bundle. Mirrors the existing
// netlify/functions/send-invite-email.ts in structure/conventions.
//
// WHY THIS FUNCTION EXISTS: password-reset emails were previously sent
// by calling supabase.auth.resetPasswordForEmail() directly from the
// browser, which makes Supabase itself generate AND send the email
// through whatever mailer Supabase Auth has configured (its built-in
// mailer, unless SMTP is set up). That's what was failing — confirmed
// live against production: a 500 "Error sending recovery email" from
// Supabase's own mail delivery. This function keeps Supabase Auth as
// the source of truth for the actual recovery TOKEN (via the admin
// generateLink API, which creates a real, valid Supabase recovery link
// without Supabase trying to email it itself), and sends that link
// through Resend instead. supabase/migrations are untouched; the
// reset-password page's session handling is untouched — the link this
// produces is the exact same kind of Supabase recovery link either way,
// so ResetPassword.tsx needs no changes.
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
// Optional:
//   RESEND_FROM_EMAIL   defaults to "Monad Africa <noreply@monadafrica.com>"
//   SITE_URL            defaults to https://monadafrica.com — this is
//                        what the recovery link's redirect target is
//                        built from ({SITE_URL}/reset-password), so it
//                        must also be listed (or covered by a wildcard)
//                        in Supabase → Authentication → URL
//                        Configuration → Redirect URLs, or Supabase
//                        will silently fall back to its own default
//                        Site URL instead of honoring this one.
//
// Anti-enumeration: this endpoint always returns the same shape for "no
// such account" as for "email sent" — it must never let a caller learn
// whether a given address has an account, matching the behavior
// Supabase's own public resetPasswordForEmail() has always had. Any
// OTHER failure (Resend down, misconfigured env vars, Supabase outage)
// is reported honestly as a real error — this endpoint never fakes
// success to hide an actual delivery failure.

import { createClient } from '@supabase/supabase-js'

interface RequestBody {
  email?: string
  redirectTo?: string
}

const SITE_URL = process.env.SITE_URL || 'https://monadafrica.com'
const DEFAULT_FROM = 'Monad Africa <noreply@monadafrica.com>'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function handler(event: { httpMethod: string; body: string | null }) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM

  if (!supabaseUrl || !serviceKey) {
    console.error('send-password-reset-email: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json(500, { ok: false, error: 'server_not_configured' })
  }
  if (!resendKey) {
    console.error('send-password-reset-email: missing RESEND_API_KEY')
    return json(500, { ok: false, error: 'server_not_configured' })
  }

  let payload: RequestBody
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }

  const email = (payload.email || '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return json(400, { ok: false, error: 'invalid_email' })
  }
  // Only ever redirect within this site's own origin — a caller-supplied
  // redirectTo is otherwise trusted as-is, so this prevents it being
  // used to send a valid recovery link's redirect to an arbitrary host.
  const redirectTo = payload.redirectTo && payload.redirectTo.startsWith(SITE_URL)
    ? payload.redirectTo
    : `${SITE_URL}/reset-password`

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data, error: genErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (genErr || !data?.properties?.action_link) {
    // "No account for this email" must look identical to success to the
    // caller (anti-enumeration) — everything else is a real failure the
    // caller should be told about, not swallowed.
    const msg = (genErr?.message || '').toLowerCase()
    const isNoSuchUser = msg.includes('not found') || msg.includes('no user') || msg.includes('does not exist')
    if (isNoSuchUser) {
      return json(200, { ok: true })
    }
    console.error('send-password-reset-email: generateLink failed:', genErr)
    return json(200, { ok: false, error: genErr?.message || 'link_generation_failed' })
  }

  const html = renderEmailHtml({ actionLink: data.properties.action_link })

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Reset your Monad Africa password',
        html,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText)
      console.error('send-password-reset-email: Resend send failed:', resp.status, errText.slice(0, 500))
      return json(200, { ok: false, error: 'send_failed' })
    }

    return json(200, { ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('send-password-reset-email: Resend request threw:', message)
    return json(200, { ok: false, error: 'send_failed' })
  }
}

function renderEmailHtml({ actionLink }: { actionLink: string }) {
  return `
  <div style="background:#07050A;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#0F0B16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="padding:28px 32px 0 32px;">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#A99AFF;font-weight:600;">Monad Africa</div>
        <h1 style="font-size:22px;color:#ffffff;margin:12px 0 4px 0;">Reset your password</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 24px 0;">
          Someone requested a password reset for this email address. If that was you, click below to choose a new password.
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
      </div>

      <div style="margin:0 32px 28px 32px;text-align:center;">
        <a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#8C79FF,#6E54FF);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 32px;border-radius:999px;">
          Set a new password
        </a>
      </div>

      <div style="margin:0 32px 28px 32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="color:rgba(255,255,255,0.5);font-size:12px;line-height:1.6;margin:0;">
          This link expires soon and can only be used once. If the button doesn't work, copy and paste this URL into your browser:
        </p>
        <p style="color:rgba(140,121,255,0.9);font-size:12px;line-height:1.6;margin:8px 0 0 0;word-break:break-all;">${actionLink}</p>
      </div>

      <div style="background:rgba(255,255,255,0.02);padding:16px 32px;text-align:center;">
        <a href="${SITE_URL}" style="color:rgba(255,255,255,0.3);font-size:11px;text-decoration:none;">© ${new Date().getFullYear()} Monad Africa · ${SITE_URL.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  </div>`
}
