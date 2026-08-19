import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import MonadMark from '../components/MonadMark'
import { getErrorMessage, logError } from '../lib/errors'

// Password reset uses Supabase Auth's own native link-based recovery
// flow end to end: resetPasswordForEmail() here sends the email (its
// "Reset Password" template's button must point at {{ .ConfirmationURL }}
// — see supabase/email-templates/reset-password-link.html), the user
// clicks it, lands on /reset-password with a recovery session Supabase
// establishes automatically (see ResetPassword.tsx), and sets a new
// password there. No custom OTP/code system for this flow — deliberate,
// per requirement to use Supabase's own recovery mechanism as-is.
export default function ForgotPassword() {
  const { resetPasswordRequest } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await resetPasswordRequest(email)
      setDone(true)
    } catch (err) {
      // Full technical error always logged; getErrorMessage() (and
      // AuthContext's resetPasswordRequest, which recovers the real
      // Supabase error body when the SDK's own message is a useless
      // "{}" — see its comments) means a genuine failure shows
      // Supabase's actual message here, not a guess.
      logError('[ForgotPassword] resetPasswordRequest failed:', err)
      const e2 = err as { status?: number }
      const fallback = typeof e2?.status === 'number' && e2.status >= 500
        ? "We couldn't send the email right now — this looks like a temporary problem on our end, not with your email address. Please try again in a few minutes."
        : 'Something went wrong. Double check the email and try again.'
      setError(getErrorMessage(err, fallback))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen flex items-center">
      <div className="max-w-sm mx-auto px-6 w-full text-center">
        <Reveal>
          <div className="flex justify-center mb-5"><MonadMark size={40} /></div>
          {done ? (
            <>
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
              <h1 className="font-display font-semibold text-2xl mb-3">Check your email</h1>
              <p className="text-white/55 text-sm leading-relaxed mb-8">
                If an account exists for {email}, a password reset link is on its way. Click it to set a new password.
              </p>
              <Link to="/login" className="text-purple-light text-sm">Back to login</Link>
            </>
          ) : (
            <>
              <h1 className="font-display font-semibold text-2xl mb-2">Reset your password</h1>
              <p className="text-white/50 text-sm mb-8">We'll email you a link to set a new one.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Email</label>
                  <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
                </div>
                {error && <div className="text-sm text-rose-300">{error}</div>}
                <button type="submit" disabled={loading} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
              <Link to="/login" className="text-purple-light text-sm mt-6 inline-block">Back to login</Link>
            </>
          )}
        </Reveal>
      </div>
    </section>
  )
}
