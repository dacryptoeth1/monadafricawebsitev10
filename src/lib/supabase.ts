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

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true, // keeps the session in localStorage so a refresh doesn't log you out
    autoRefreshToken: true, // silently refreshes the access token before it expires
    detectSessionInUrl: true, // required for Google OAuth redirects and email confirmation links to complete
  },
})
