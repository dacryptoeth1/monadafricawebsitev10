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
    if (!res.ok) return { ok: false }
    const json = await res.json().catch(() => ({ ok: false }))
    return { ok: Boolean(json.ok) }
  } catch {
    // Function not deployed (e.g. plain `vite dev` without `netlify dev`),
    // network failure, etc. — treated the same as "email didn't send":
    // the registration itself is already saved either way.
    return { ok: false }
  }
}
