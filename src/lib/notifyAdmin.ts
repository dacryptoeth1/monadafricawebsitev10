import { supabase } from './supabase'

// Talks to api/notify-admin.ts (a Vercel serverless function — this
// project deploys on Vercel, not Netlify) — fire-and-forget from
// Partner.tsx / HostBounty.tsx right after a successful submit. Never
// blocks or fails the submission itself: the application/request row is
// already saved in Supabase either way, this is purely the "email the
// BD team" notification channel on top of it.
export async function notifyAdmin(entityType: 'partnership_application' | 'bounty_hosting_request', entityId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
    })
  } catch (err) {
    // Best-effort only — e.g. running via plain `vite dev` without
    // `vercel dev`, where /api routes aren't served.
    console.error('[notifyAdmin] request failed (submission itself was still saved):', err)
  }
}
