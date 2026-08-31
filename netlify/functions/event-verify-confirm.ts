// Netlify Function — step 2 of the event email-verification flow: the
// signed-in user submits the 6-digit code. On a match, mint (or return
// the already-existing) personal invite code for this user+event. See
// event-verify-request.ts for step 1 and
// netlify/functions/_lib/eventVerifyShared.ts for shared helpers.

import {
  MAX_ATTEMPTS,
  authenticateRequest,
  getAdminClient,
  getEnvOrFail,
  jsonResponse,
  otpMatches,
} from './_lib/eventVerifyShared'

interface RequestBody {
  event_id?: string
  code?: string
}

export async function handler(event: { httpMethod: string; body: string | null; headers: Record<string, string | undefined> }) {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { ok: false, error: 'method_not_allowed' })

  const env = getEnvOrFail()
  if (!env) {
    console.error('event-verify-confirm: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
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
  const submittedCode = (payload.code || '').trim()
  if (!eventId) return jsonResponse(400, { ok: false, error: 'missing_event_id' })
  if (!/^\d{6}$/.test(submittedCode)) return jsonResponse(200, { ok: false, error: 'invalid_code' })

  const { data: otpRow, error: otpErr } = await admin
    .from('event_email_verifications')
    .select('id, code_hash, salt, expires_at, attempt_count, verified')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .maybeSingle()
  if (otpErr || !otpRow) return jsonResponse(200, { ok: false, error: 'no_pending_code' })

  // Already verified — idempotent: hand back the existing code instead
  // of erroring, so a stray double-submit (e.g. a slow network retry)
  // can't look like a failure.
  if (otpRow.verified) {
    const { data: existingCode } = await admin
      .from('event_invite_codes')
      .select('invite_code')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .eq('status', 'active')
      .maybeSingle()
    if (existingCode) return jsonResponse(200, { ok: true, invite_code: existingCode.invite_code })
    // Verified but no code somehow exists — fall through and mint one.
  }

  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    return jsonResponse(200, { ok: false, error: 'expired' })
  }
  if (otpRow.attempt_count >= MAX_ATTEMPTS) {
    return jsonResponse(200, { ok: false, error: 'too_many_attempts' })
  }

  const matches = otpMatches(submittedCode, otpRow.salt, otpRow.code_hash)
  if (!matches) {
    const nextAttempts = otpRow.attempt_count + 1
    await admin.from('event_email_verifications').update({ attempt_count: nextAttempts }).eq('id', otpRow.id)
    if (nextAttempts >= MAX_ATTEMPTS) {
      return jsonResponse(200, { ok: false, error: 'too_many_attempts' })
    }
    return jsonResponse(200, { ok: false, error: 'invalid_code', attempts_remaining: MAX_ATTEMPTS - nextAttempts })
  }

  await admin
    .from('event_email_verifications')
    .update({ verified: true, verified_at: new Date().toISOString() })
    .eq('id', otpRow.id)

  // Race guard: two confirm calls landing back-to-back (e.g. a
  // double-submit) could both pass the match check above before either
  // has inserted a code — re-check for an existing one right before
  // minting, and let the table's unique(user_id, event_id) constraint
  // be the final backstop if that race is still lost.
  const { data: raceCheck } = await admin
    .from('event_invite_codes')
    .select('invite_code')
    .eq('user_id', user.id)
    .eq('event_id', eventId)
    .eq('status', 'active')
    .maybeSingle()
  if (raceCheck) return jsonResponse(200, { ok: true, invite_code: raceCheck.invite_code })

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: generated, error: genErr } = await admin.rpc('generate_event_verification_invite_code')
    if (genErr || !generated) {
      console.error('event-verify-confirm: code generation failed:', genErr)
      return jsonResponse(500, { ok: false, error: 'code_generation_failed' })
    }
    const { data: inserted, error: insertErr } = await admin
      .from('event_invite_codes')
      .insert({ user_id: user.id, event_id: eventId, invite_code: generated, status: 'active' })
      .select('invite_code')
      .maybeSingle()
    if (!insertErr && inserted) {
      return jsonResponse(200, { ok: true, invite_code: inserted.invite_code })
    }
    // unique_violation on invite_code (23505) — vanishingly rare, retry
    // with a freshly generated code. unique_violation on (user_id,
    // event_id) means a concurrent request won the race — fetch and
    // return what it inserted instead of erroring.
    const { data: raceWinner } = await admin
      .from('event_invite_codes')
      .select('invite_code')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .eq('status', 'active')
      .maybeSingle()
    if (raceWinner) return jsonResponse(200, { ok: true, invite_code: raceWinner.invite_code })
  }

  return jsonResponse(500, { ok: false, error: 'code_generation_failed' })
}
