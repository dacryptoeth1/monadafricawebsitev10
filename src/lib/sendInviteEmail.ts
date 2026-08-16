// Talks to the one server-side piece of this feature (netlify/functions/send-invite-email.ts).
// Never touches an email provider API key directly — that key only ever
// lives in Netlify's function environment.
export async function sendInviteEmail(payload: {
  registrationId: string
  inviteCode?: string
  accessToken?: string
}): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/.netlify/functions/send-invite-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(payload.accessToken ? { Authorization: `Bearer ${payload.accessToken}` } : {}),
      },
      body: JSON.stringify({ registration_id: payload.registrationId, invite_code: payload.inviteCode }),
    })
    if (!res.ok) {
      // TEMPORARY diagnostic — logs the HTTP status and whatever body
      // the function returned, so a failure is inspectable instead of
      // silently collapsing to { ok: false }. A 404 here means the
      // Netlify Function route itself isn't available (e.g. plain
      // `vite dev` instead of `netlify dev`, or not deployed); a 500
      // with server_not_configured means required env vars are missing
      // in Netlify's function environment.
      const body = await res.text().catch(() => '(could not read response body)')
      console.error(`[sendInviteEmail] request failed: HTTP ${res.status} ${res.statusText}`, body)
      return { ok: false }
    }
    const json = await res.json().catch(() => ({ ok: false }))
    if (!json.ok) console.error('[sendInviteEmail] function reported failure:', json)
    return { ok: Boolean(json.ok) }
  } catch (err) {
    // Function not deployed (e.g. plain `vite dev` without `netlify dev`),
    // network failure, etc. — treated the same as "email didn't send":
    // the registration itself is already saved either way.
    console.error('[sendInviteEmail] request threw (function route likely unreachable):', err)
    return { ok: false }
  }
}
