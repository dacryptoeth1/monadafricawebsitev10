// Netlify Function — issues a password-reset OTP for one email and
// sends it via Resend, entirely bypassing Supabase's built-in "Reset
// Password" auth email (which is stuck on Supabase's default,
// link-based template — template editing there is locked until Custom
// SMTP is enabled on the project, which this project deliberately isn't
// doing).
//
// This does NOT implement a custom OTP system. It calls Supabase
// Auth's own Admin API — auth.admin.generateLink({ type: 'recovery' })
// — which mints a real Supabase recovery token and hands back its
// plaintext OTP form as data.properties.email_otp. That value is
// exactly what supabase.auth.verifyOtp({ email, token, type: 'recovery' })
// (called directly from the client in AuthContext.tsx, unchanged)
// expects. generateLink() never sends an email itself — this function
// sends the ONE email, with the OTP, via Resend's API directly, so
// Supabase's locked default template never enters the picture.
//
// Required env vars (Netlify function environment — never VITE_-
// prefixed, never shipped to the client bundle):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL
//
// Security notes:
//   - Never reveals whether an account exists for the given email: on
//     every path (unknown email, cooldown, send failure) the HTTP
//     status/body a legitimate "yes, if that's you, check your inbox"
//     response is indistinguishable from a generic error to a caller
//     probing for which emails have accounts — the frontend already
//     shows the same "If an account exists…" copy regardless.
//   - Enforces its own 60s per-email resend cooldown via
//     password_reset_cooldowns (0034) — the Admin API has no built-in
//     rate limit the way the public recover endpoint does.
//   - The service-role key never leaves this function.

import { createClient } from '@supabase/supabase-js'

const RESEND_COOLDOWN_MS = 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface RequestBody {
  email?: string
}

function json(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export async function handler(event: { httpMethod: string; body: string | null }) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' })

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!supabaseUrl || !serviceKey) {
    console.error('password-reset-request: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json(500, { ok: false, error: 'server_not_configured' })
  }
  if (!resendKey || !fromEmail) {
    console.error('password-reset-request: missing RESEND_API_KEY / RESEND_FROM_EMAIL')
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

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // --- Cooldown check ---------------------------------------------------
  const { data: cooldownRow } = await admin
    .from('password_reset_cooldowns')
    .select('last_sent_at')
    .eq('email', email)
    .maybeSingle()
  if (cooldownRow) {
    const elapsed = Date.now() - new Date(cooldownRow.last_sent_at).getTime()
    if (elapsed < RESEND_COOLDOWN_MS) {
      return json(429, { ok: false, error: 'cooldown', retry_after_seconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) })
    }
  }
  // Record the attempt up front, before we know whether the account
  // exists — the cooldown itself must not leak that information either.
  await admin.from('password_reset_cooldowns').upsert({ email, last_sent_at: new Date().toISOString() }, { onConflict: 'email' })

  // --- Mint the recovery OTP via Supabase's own Admin API ---------------
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'recovery', email })

  // Unknown email (or any other generateLink failure): say nothing —
  // respond exactly like a successful send so this endpoint can't be
  // used to enumerate registered accounts.
  if (linkErr || !linkData?.properties?.email_otp) {
    if (linkErr && !/not.*found/i.test(linkErr.message || '')) {
      console.error('password-reset-request: generateLink failed:', linkErr)
    }
    return json(200, { ok: true })
  }

  const code = linkData.properties.email_otp

  const html = renderPasswordResetOtpEmail({ code, email })

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [email], subject: 'Your Monad Africa password reset code', html }),
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText)
      console.error('password-reset-request: Resend send failed:', errText.slice(0, 500))
      return json(500, { ok: false, error: 'send_failed' })
    }
  } catch (err) {
    console.error('password-reset-request: Resend send threw:', err)
    return json(500, { ok: false, error: 'send_failed' })
  }

  return json(200, { ok: true })
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Same dark/purple panel styling as send-invite-email.ts / the event OTP
// email, so every Monad Africa email reads as the same product. No
// specific expiry duration is stated — that's governed by the project's
// "Email OTP Expiration" Auth setting in Supabase, which this function
// doesn't control, so it isn't hardcoded here to avoid ever printing a
// wrong number.
function renderPasswordResetOtpEmail(args: { code: string; email: string }): string {
  return `
  <div style="background:#07050A;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#0F0B16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="padding:28px 32px 0 32px;">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#A99AFF;font-weight:600;">Monad Africa</div>
        <h1 style="font-size:22px;color:#ffffff;margin:12px 0 4px 0;">Reset your password</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 20px 0;">
          We received a request to reset the password for your Monad Africa account (<strong style="color:#ffffff;">${escapeHtml(args.email)}</strong>). Enter the code below to continue.
        </p>
      </div>

      <div style="margin:0 32px 24px 32px;background:rgba(110,84,255,0.08);border:1px solid rgba(110,84,255,0.3);border-radius:16px;padding:20px 24px;text-align:center;">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#A99AFF;margin-bottom:8px;">Your password reset code</div>
        <div style="font-size:32px;letter-spacing:0.2em;color:#ffffff;font-family:'Courier New',monospace;font-weight:700;">${escapeHtml(args.code)}</div>
      </div>

      <div style="margin:0 32px 24px 32px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;">
        <div>This code can only be used once. If it doesn't work, request a new one from the reset-password screen.</div>
      </div>

      <div style="margin:0 32px 28px 32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;margin:0;">
          If you didn't request a password reset, you can safely ignore this email — your password won't be changed. Never share this code with anyone, including someone claiming to be Monad Africa staff.
        </p>
      </div>

      <div style="background:rgba(255,255,255,0.02);padding:16px 32px;text-align:center;">
        <span style="color:rgba(255,255,255,0.3);font-size:11px;">© ${new Date().getFullYear()} Monad Africa</span>
      </div>
    </div>
  </div>`
}
