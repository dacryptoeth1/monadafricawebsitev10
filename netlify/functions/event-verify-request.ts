// Netlify Function — step 1 of the event email-verification flow: a
// signed-in user asks to verify their account email for one event and
// receive their invite code. Generates a 6-digit code, stores only its
// salted hash, and emails the plaintext code via Resend — the code
// itself never appears in the JSON response, logs, or anywhere
// client-visible. See netlify/functions/_lib/eventVerifyShared.ts for
// the shared crypto/email helpers and
// supabase/migrations/0033_event_email_verification_and_invite_codes.sql
// for the matching schema/RLS.
//
// This is a NEW, separate system from send-invite-email.ts /
// register_for_event() — it does not touch events, event_registrations,
// or the existing instant-registration invite code at all.

import {
  MAX_ATTEMPTS,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  authenticateRequest,
  generateOtp,
  getAdminClient,
  getEnvOrFail,
  jsonResponse,
  renderEventOtpEmail,
  sendResendEmail,
} from './_lib/eventVerifyShared'

interface RequestBody {
  event_id?: string
}

export async function handler(event: { httpMethod: string; body: string | null; headers: Record<string, string | undefined> }) {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { ok: false, error: 'method_not_allowed' })

  const env = getEnvOrFail()
  if (!env) {
    console.error('event-verify-request: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return jsonResponse(500, { ok: false, error: 'server_not_configured' })
  }
  const admin = getAdminClient(env.supabaseUrl, env.serviceKey)

  const user = await authenticateRequest(event.headers, admin)
  if (!user) return jsonResponse(401, { ok: false, error: 'not_authenticated' })

  let payload: RequestBody
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' })
  }
  const eventId = payload.event_id
  if (!eventId) return jsonResponse(400, { ok: false, error: 'missing_event_id' })

  const { data: eventRow, error: eventErr } = await admin
    .from('events')
    .select('id, title, status, registration_open, registration_deadline, requires_email_verification')
    .eq('id', eventId)
    .maybeSingle()
  if (eventErr || !eventRow) return jsonResponse(404, { ok: false, error: 'not_found' })
  if (!eventRow.requires_email_verification) return jsonResponse(400, { ok: false, error: 'not_applicable' })
  if (eventRow.status !== 'published') return jsonResponse(200, { ok: false, error: 'closed' })
  if (!eventRow.registration_open) return jsonResponse(200, { ok: false, error: 'closed' })
  if (eventRow.registration_deadline && new Date(eventRow.registration_deadline).getTime() < Date.now()) {
    return jsonResponse(200, { ok: false, error: 'closed' })
  }

  // Already verified and holding an active code for this event? Hand
  // the SAME code back — never issue a second one, never re-send an
  // OTP for something already proven.
  const { data: existingCode } = await admin
    .from('event_invite_codes')
    .select('invite_code')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .eq('status', 'active')
    .maybeSingle()
  if (existingCode) {
    return jsonResponse(200, { ok: true, already_verified: true, invite_code: existingCode.invite_code })
  }

  // Resend cooldown — checked against whatever row (if any) already
  // exists for this user+event before it gets overwritten below.
  const { data: existingOtp } = await admin
    .from('event_email_verifications')
    .select('updated_at')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .maybeSingle()
  if (existingOtp) {
    const elapsed = Date.now() - new Date(existingOtp.updated_at).getTime()
    if (elapsed < RESEND_COOLDOWN_MS) {
      return jsonResponse(200, { ok: false, error: 'cooldown', retry_after_seconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) })
    }
  }

  const { code, salt, codeHash } = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

  const { error: upsertErr } = await admin
    .from('event_email_verifications')
    .upsert(
      {
        user_id: user.id,
        event_id: eventId,
        email: user.email,
        code_hash: codeHash,
        salt,
        expires_at: expiresAt,
        attempt_count: 0,
        verified: false,
        verified_at: null,
      },
      { onConflict: 'user_id,event_id' },
    )
  if (upsertErr) {
    console.error('event-verify-request: failed to store OTP:', upsertErr)
    return jsonResponse(500, { ok: false, error: 'storage_failed' })
  }

  const html = renderEventOtpEmail({ eventTitle: eventRow.title, code, minutesValid: Math.round(OTP_TTL_MS / 60000) })
  const sendResult = await sendResendEmail({
    to: user.email,
    subject: 'Your Monad Africa Event Verification Code',
    html,
  })

  if (!sendResult.ok) {
    console.error('event-verify-request: email send failed:', sendResult.error)
    return jsonResponse(200, { ok: false, error: 'send_failed' })
  }

  return jsonResponse(200, {
    ok: true,
    sent: true,
    expires_in_seconds: Math.round(OTP_TTL_MS / 1000),
    max_attempts: MAX_ATTEMPTS,
  })
}
