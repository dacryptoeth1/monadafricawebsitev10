import { supabase } from './supabase'

// Talks to api/notify-admin.ts (a Vercel serverless function — this
// project deploys on Vercel, not Netlify) — called from Partner.tsx /
// Partners.tsx / HostBounty.tsx right after a successful submit. Never
// blocks or fails the submission itself: the application/request row is
// already saved in Supabase either way, this is purely the "email the
// Monad Africa team" notification channel on top of it.
//
// Returns whether the email genuinely went out, so a caller can show an
// honest (non-alarming) note if it didn't — never claim "emailed" when
// it wasn't, and never let an email failure look like the submission
// itself failed, since that part already succeeded independently.
export async function notifyAdmin(entityType: 'partnership_application' | 'bounty_hosting_request', entityId: string): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return false
    const resp = await fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
    })
    if (!resp.ok) return false
    const body = (await resp.json().catch(() => null)) as { ok?: boolean } | null
    return body?.ok === true
  } catch (err) {
    // e.g. running via plain `vite dev` without `vercel dev`, where
    // /api routes aren't served, or a genuine network failure.
    console.error('[notifyAdmin] request failed (submission itself was still saved):', err)
    return false
  }
}
