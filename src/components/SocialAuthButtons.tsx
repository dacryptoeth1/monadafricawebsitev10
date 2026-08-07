import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function SocialAuthButtons() {
  const { signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setError(null)
    try {
      await signInWithGoogle()
      // supabase redirects the browser away immediately on success, so
      // there's nothing further to do here.
    } catch {
      setError("Google sign-in isn't available yet — it needs to be enabled in the Supabase dashboard first.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-white/30 text-xs">
        <div className="h-px flex-1 bg-white/10" />
        or continue with
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <button
        type="button"
        onClick={handleGoogle}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
      >
        <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.1 27 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.6C39.9 37 44 31 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>
        Continue with Google
      </button>
      {error && <div className="text-xs text-amber-300 text-center">{error}</div>}
    </div>
  )
}
