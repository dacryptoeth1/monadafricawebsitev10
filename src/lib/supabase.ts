import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// createClient() throws synchronously with an opaque library error
// ("supabaseUrl is required.") if either value is missing — and since
// this module is imported transitively by App.tsx on every route, that
// throw happens before React renders anything at all, producing a
// blank page with no visible message. Fail with a clear, specific
// message instead, so a missing/misconfigured environment variable
// (e.g. not set in Netlify's build environment) is immediately
// diagnosable via the ErrorBoundary in main.tsx instead of showing up
// as an unexplained blank screen.
if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase configuration: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set. ' +
    'If this is a deployed build, set them in Netlify → Site configuration → Environment variables, then redeploy.'
  )
}

// A malformed/wrong VITE_SUPABASE_URL (a stale local-dev value, a typo,
// a placeholder that was never replaced, etc.) doesn't fail here — it
// fails later as an opaque browser-level "Failed to fetch" the moment
// any auth/query call tries to reach it, which looks identical to a
// real network outage and gives no clue what's actually wrong. Catch
// the obviously-broken cases immediately, with a message that says
// exactly what's wrong instead of leaving it to a generic fetch error.
let parsedUrl: URL
try {
  parsedUrl = new URL(url)
} catch {
  throw new Error(`Invalid VITE_SUPABASE_URL: "${url}" is not a valid URL. It should look like https://xxxxxxxx.supabase.co.`)
}
if (parsedUrl.protocol !== 'https:') {
  throw new Error(`Invalid VITE_SUPABASE_URL: "${url}" must use https:// (found "${parsedUrl.protocol}"). A local/http URL will never work from a deployed site.`)
}

// The URL itself is not a secret (every Supabase project's URL is
// visible in any browser's network tab regardless), so logging it is
// safe and is the fastest way to confirm — by comparing against the
// Supabase dashboard — whether a deployed build is actually using the
// right project when auth/queries fail with an opaque network error.
console.log('[supabase] Using project URL:', url)

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true, // keeps the session in localStorage so a refresh doesn't log you out
    autoRefreshToken: true, // silently refreshes the access token before it expires
    detectSessionInUrl: true, // required for email confirmation/password-reset links to complete
  },
})
