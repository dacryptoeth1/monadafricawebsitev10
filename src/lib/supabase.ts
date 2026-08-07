import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true, // keeps the session in localStorage so a refresh doesn't log you out
    autoRefreshToken: true, // silently refreshes the access token before it expires
    detectSessionInUrl: true, // required for Google OAuth redirects and email confirmation links to complete
  },
})
