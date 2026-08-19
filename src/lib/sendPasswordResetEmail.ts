// Talks to the one server-side piece of this feature
// (netlify/functions/send-password-reset-email.ts). Never touches the
// Resend API key or the Supabase service-role key directly — those
// only ever live in Netlify's function environment. Mirrors
// sendInviteEmail.ts's shape/conventions.
export async function sendPasswordResetEmail(payload: {
  email: string
  redirectTo: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/.netlify/functions/send-password-reset-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({ ok: false, error: 'invalid_response' }))
    if (!res.ok || !json.ok) {
      // Logged for developers; ForgotPassword.tsx decides what (if
      // anything) to show the user from the returned `error` — a 404
      // here means the Netlify Function route itself isn't available
      // (e.g. plain `vite dev` instead of `netlify dev`, or not
      // deployed yet); a 500 with server_not_configured means required
      // env vars are missing in Netlify's function environment.
      console.error(`[sendPasswordResetEmail] request failed: HTTP ${res.status}`, json)
      return { ok: false, error: json?.error }
    }
    return { ok: true }
  } catch (err) {
    console.error('[sendPasswordResetEmail] request threw (function route likely unreachable):', err)
    return { ok: false, error: 'network_error' }
  }
}
