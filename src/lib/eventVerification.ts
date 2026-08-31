// Talks to the two Netlify Functions backing the event email-verification
// + personal invite code feature (netlify/functions/event-verify-request.ts,
// netlify/functions/event-verify-confirm.ts). Same pattern as
// sendInviteEmail.ts: this is the only place in the client bundle that
// knows these routes exist, and it never sees or stores a plaintext OTP —
// only pass-through result shapes the functions themselves decide.
import { supabase } from './supabase'

export type EventVerifyRequestResult =
  | { ok: true; already_verified: true; invite_code: string }
  | { ok: true; sent: true; expires_in_seconds: number; max_attempts: number }
  | { ok: false; error: string; retry_after_seconds?: number }

export type EventVerifyConfirmResult =
  | { ok: true; invite_code: string }
  | { ok: false; error: string; attempts_remaining?: number }

async function callFunction<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'not_authenticated' } as T
  try {
    const res = await fetch(`/.netlify/functions/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({ ok: false, error: 'invalid_response' }))
    if (!res.ok && json.ok === undefined) {
      console.error(`[eventVerification] ${path} failed: HTTP ${res.status}`)
      return { ok: false, error: 'request_failed' } as T
    }
    return json as T
  } catch (err) {
    console.error(`[eventVerification] ${path} request threw:`, err)
    return { ok: false, error: 'network_error' } as T
  }
}

export function requestEventVerification(eventId: string): Promise<EventVerifyRequestResult> {
  return callFunction<EventVerifyRequestResult>('event-verify-request', { event_id: eventId })
}

export function confirmEventVerification(eventId: string, code: string): Promise<EventVerifyConfirmResult> {
  return callFunction<EventVerifyConfirmResult>('event-verify-confirm', { event_id: eventId, code })
}
