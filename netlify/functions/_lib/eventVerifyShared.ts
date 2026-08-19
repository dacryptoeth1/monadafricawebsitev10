// Shared helpers for event-verify-request.ts and event-verify-confirm.ts —
// the two Netlify Functions backing the NEW, opt-in-per-event email
// verification + personal invite code feature (see
// supabase/migrations/0033_event_email_verification_and_invite_codes.sql).
// This is a completely separate concern from send-invite-email.ts /
// register_for_event() (the existing instant-registration invite code),
// which this file does not touch.
//
// Required env vars (Netlify function environment, never VITE_-prefixed,
// never shipped to the client bundle):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL
// Optional:
//   EVENT_OTP_PEPPER   — extra secret mixed into the OTP hash alongside
//                         a per-row random salt. Defense-in-depth only
//                         (a leaked DB alone still isn't enough to
//                         recover a code without this); the salt alone
//                         already makes each hash unique. If unset, the
//                         pepper is simply an empty string — hashing
//                         with a per-row salt still holds.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto'

export const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
export const MAX_ATTEMPTS = 5

export function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function getEnvOrFail(): { supabaseUrl: string; serviceKey: string } | null {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return { supabaseUrl, serviceKey }
}

export function getAdminClient(supabaseUrl: string, serviceKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

// Verifies the bearer token against Supabase Auth and returns the real,
// server-confirmed account id/email — never trusts a client-supplied
// user id or email for any of this. Returns null if the token is
// missing/invalid, which callers treat as 401.
export async function authenticateRequest(
  headers: Record<string, string | undefined>,
  admin: SupabaseClient,
): Promise<{ id: string; email: string } | null> {
  const authHeader = headers.authorization || headers.Authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user?.email) return null
  return { id: data.user.id, email: data.user.email }
}

// Generates a cryptographically random 6-digit code and its salted
// (+optionally peppered) SHA-256 hash. The plaintext code is returned
// ONLY so the caller (event-verify-request.ts) can put it in the
// outgoing email — it is never written anywhere, logged, or returned
// to the browser.
export function generateOtp(): { code: string; salt: string; codeHash: string } {
  const code = String(randomInt(100000, 1000000)) // always 6 digits, CSPRNG
  const salt = randomBytes(16).toString('hex')
  const codeHash = hashOtp(code, salt)
  return { code, salt, codeHash }
}

export function hashOtp(code: string, salt: string): string {
  const pepper = process.env.EVENT_OTP_PEPPER || ''
  return createHash('sha256').update(`${code}:${salt}:${pepper}`).digest('hex')
}

// Constant-time comparison so a mismatch can't leak timing information
// about how many leading hex characters matched.
export function otpMatches(submittedCode: string, salt: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(submittedCode, salt), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

export async function sendResendEmail(args: { to: string; subject: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendKey || !fromEmail) return { ok: false, error: 'email_not_configured' }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [args.to], subject: args.subject, html: args.html }),
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText)
      return { ok: false, error: errText.slice(0, 500) }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Same dark/purple panel styling as send-invite-email.ts's
// renderEmailHtml, reused here so both emails read as the same product.
export function renderEventOtpEmail(args: { eventTitle: string; code: string; minutesValid: number }): string {
  return `
  <div style="background:#07050A;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#0F0B16;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
      <div style="padding:28px 32px 0 32px;">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#A99AFF;font-weight:600;">Monad Africa</div>
        <h1 style="font-size:22px;color:#ffffff;margin:12px 0 4px 0;">Verify your email</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;margin:0 0 20px 0;">
          You requested a verification code to confirm your email for <strong style="color:#ffffff;">${escapeHtml(args.eventTitle)}</strong> on Monad Africa. Enter this code to receive your unique event invite code.
        </p>
      </div>

      <div style="margin:0 32px 24px 32px;background:rgba(110,84,255,0.08);border:1px solid rgba(110,84,255,0.3);border-radius:16px;padding:20px 24px;text-align:center;">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#A99AFF;margin-bottom:8px;">Your verification code</div>
        <div style="font-size:32px;letter-spacing:0.2em;color:#ffffff;font-family:'Courier New',monospace;font-weight:700;">${escapeHtml(args.code)}</div>
      </div>

      <div style="margin:0 32px 24px 32px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.8;">
        <div>This code expires in <strong style="color:#fff;">${args.minutesValid} minutes</strong> and can only be used once.</div>
      </div>

      <div style="margin:0 32px 28px 32px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;margin:0;">
          If you didn't request this, you can safely ignore this email — no one can access your account or this event's invite code without this code. Never share it with anyone, including someone claiming to be Monad Africa staff.
        </p>
      </div>

      <div style="background:rgba(255,255,255,0.02);padding:16px 32px;text-align:center;">
        <span style="color:rgba(255,255,255,0.3);font-size:11px;">© ${new Date().getFullYear()} Monad Africa</span>
      </div>
    </div>
  </div>`
}
