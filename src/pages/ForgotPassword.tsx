import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import { getErrorMessage, logError } from '../lib/errors'

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
      // Previously a bare `catch { setError('generic message') }` — the
      // actual Supabase/GoTrue error was silently discarded, so every
      // failure looked identical and undiagnosable from the browser.
      // Now logged in full (message/status/name/code — Supabase Auth
      // errors carry status/name that logError()'s Postgrest-shaped
      // {message, details, hint, code} logging doesn't surface).
      logError('[ForgotPassword] resetPasswordRequest failed:', err)
      const e = err as { message?: string; status?: number; name?: string; code?: string }
      console.error('[ForgotPassword] resetPasswordForEmail error detail:', {
        message: e?.message, status: e?.status, name: e?.name, code: e?.code,
      })

      // Root cause (confirmed live against production Supabase, real
      // registered account): the request reaches Supabase fine and gets
      // a 500 back — {"error_code":"unexpected_failure","msg":"Error
      // sending recovery email"} — a server-side email-delivery failure
      // (Supabase Auth's SMTP/mailer configuration), not anything wrong
      // with the email address typed in. On top of that, supabase-js
      // wraps 5xx responses in an AuthRetryableFetchError whose
      // `.message` has been observed to literally be the string "{}" —
      // that's what rendered as a bare "{}" in the UI (getErrorMessage
      // now treats "{}" as no real message, see lib/errors.ts). Since
      // "double check the email" is actively wrong advice for a 5xx
      // server error, that fallback is only used for non-5xx failures;
      // a 5xx gets an honest, status-aware message instead.
      const status = e?.status
      const fallback = typeof status === 'number' && status >= 500
        ? "We couldn't send the reset email right now — this looks like a temporary problem on our end, not with your email address. Please try again in a few minutes."
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
          {done ? (
            <>
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
              <h1 className="font-display font-semibold text-2xl mb-3">Check your email</h1>
              <p className="text-white/55 text-sm leading-relaxed mb-8">
                If an account exists for {email}, a password reset link is on its way.
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
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
                </div>
                {error && <div className="text-sm text-rose-300">{error}</div>}
                <button type="submit" disabled={loading} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </Reveal>
      </div>
    </section>
  )
}
