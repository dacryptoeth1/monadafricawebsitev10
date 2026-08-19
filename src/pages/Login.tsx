import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import PasswordField from '../components/PasswordField'
import MonadMark from '../components/MonadMark'

export default function Login() {
  const { signIn, resendVerificationEmail } = useAuth()
  const navigate = useNavigate()
  // `from` is the existing redirect-after-login target (set by
  // RequireAuth for gated routes). `eventId` is the same idea extended
  // for the public Events page: a logged-out visitor who clicked an
  // event to register is sent here with both, and after a successful
  // login is sent back to that exact event (see Events.tsx).
  const location = useLocation() as { state?: { from?: string; eventId?: string; message?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)
  // One-shot confirmation banner (e.g. "Password updated successfully")
  // handed over via navigate(..., { state: { message } }) from a prior
  // page — ResetPassword.tsx is the current sender. Read once on mount
  // via useState's initializer, not on every render, so it doesn't
  // reappear if the user navigates away and back without a fresh state.
  const [successMessage] = useState(location.state?.message ?? null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setUnverified(false)
    setResent(false)
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (err: any) {
      setLoading(false)
      const message = String(err?.message || '')
      console.error('[Login] signIn failed:', err)
      if (message.toLowerCase().includes('email not confirmed')) {
        setUnverified(true)
      } else if (message.toLowerCase().includes('invalid login credentials') || message.toLowerCase().includes('invalid email or password')) {
        // Supabase's actual message for a genuinely wrong email/password.
        setError('Invalid email or password.')
      } else if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('network')) {
        // A raw browser fetch failure — the request to Supabase never
        // completed at all (wrong/unreachable project URL, no network,
        // or a CORS block). This is never a credentials problem; check
        // the console.log this module's src/lib/supabase.ts prints on
        // load ("[supabase] Using project URL: ...") against the
        // correct project in the Supabase dashboard.
        setError('Could not reach the authentication server. Check your internet connection — if this keeps happening, the site may be misconfigured (see console for details).')
      } else {
        // Anything else (rate limit, project/config issue, etc.) is a
        // real, different problem — show what Supabase actually said
        // instead of misreporting it as wrong credentials, which was
        // the bug reported: correct credentials producing a false
        // "Invalid email or password".
        setError(message || 'Something went wrong signing in — please try again.')
      }
      return
    }

    // Deliberately outside the try/catch above: sign-in already
    // succeeded at this point, so any issue with the navigation call
    // itself must never be mislabeled as "Invalid email or password" —
    // that previously happened because navigate() shared the same
    // catch block as signIn(), which could report a successful login
    // as a credentials failure.
    const eventId = location.state?.eventId
    navigate(location.state?.from || '/dashboard', eventId ? { state: { openEventId: eventId } } : undefined)
    // Not resetting `loading` here on purpose — the page is navigating
    // away, so leaving the button in its loading state avoids a
    // one-frame flash back to "Log In" right before the transition.
  }

  async function handleResend() {
    try {
      await resendVerificationEmail(email)
      setResent(true)
    } catch {
      setError('Could not resend the verification email — try again shortly.')
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen flex items-center">
      <div className="max-w-sm mx-auto px-6 w-full">
        <Reveal>
          <div className="flex justify-center mb-5"><MonadMark size={40} /></div>
          <h1 className="font-display font-semibold text-3xl mb-2 text-center">Welcome back</h1>
          <p className="text-white/50 text-sm text-center mb-6">Log in to your Monad Africa account</p>

          {successMessage && (
            <div className="mb-4 text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-400/25 rounded-xl px-4 py-3 text-center">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Password</label>
                <Link to="/forgot-password" className="text-xs text-purple-light hover:text-white transition-colors">Forgot?</Link>
              </div>
              <PasswordField name="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && <div className="text-sm text-rose-300">{error}</div>}

            {unverified && (
              <div className="text-sm text-amber-300 bg-amber-300/10 border border-amber-300/25 rounded-xl px-4 py-3">
                Your email isn't verified yet.{' '}
                {resent ? (
                  'A new link is on its way — check your inbox.'
                ) : (
                  <button type="button" onClick={handleResend} className="underline font-semibold">
                    Resend verification email
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>

          <p className="text-center text-sm text-white/40 mt-8">
            Don't have an account? <Link to="/signup" className="text-purple-light hover:text-white transition-colors">Sign up</Link>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
