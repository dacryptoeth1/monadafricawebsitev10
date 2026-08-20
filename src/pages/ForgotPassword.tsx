import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import MonadMark from '../components/MonadMark'
import { getErrorMessage, logError } from '../lib/errors'

// Password reset via a 6-digit code — no link, no separate /reset-password
// route. This is the ONLY password-recovery flow in the app (the old
// link-based one, and its /reset-password route, were removed so there
// aren't two competing systems). The code itself is a real Supabase Auth
// recovery OTP end to end — verifyPasswordResetOtp and updatePassword
// (both in AuthContext.tsx) call Supabase's own verifyOtp(type:'recovery')
// and updateUser() directly, no custom OTP table. The one piece that
// ISN'T a direct Supabase Auth client call is requesting the code:
// resetPasswordRequest (AuthContext.tsx) calls
// netlify/functions/password-reset-request.ts, a small server-side
// function that mints the OTP via Supabase's Admin API and emails it via
// Resend — necessary because Supabase's built-in "Reset Password" email
// only renders its default, link-based template until Custom SMTP is
// enabled on the project, which this project deliberately isn't doing.

type Step = 'email' | 'code' | 'password' | 'success'

const RESEND_COOLDOWN_SECONDS = 60
const MAX_CODE_ATTEMPTS = 5

function scorePassword(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['bg-rose-400', 'bg-rose-400', 'bg-amber-400', 'bg-gold', 'bg-emerald-400']

export default function ForgotPassword() {
  const { resetPasswordRequest, verifyPasswordResetOtp, updatePassword, signOut } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_CODE_ATTEMPTS)
  const [cooldown, setCooldown] = useState(0)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current) }
  }, [])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function requestCode(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await resetPasswordRequest(email)
      setAttemptsRemaining(MAX_CODE_ATTEMPTS)
      setCode('')
      setStep('code')
      startCooldown()
    } catch (err) {
      logError('[ForgotPassword] resetPasswordRequest failed:', err)
      const e2 = err as { message?: string; status?: number }
      // Supabase's own resend rate-limit (429) shows up here on a fast
      // re-request — surfaced as a cooldown message rather than a
      // generic error, since the user's action (request a code) was
      // otherwise valid.
      if (e2?.status === 429) {
        setError("You're requesting codes too quickly. Please wait a moment and try again.")
        startCooldown()
      } else {
        const fallback = typeof e2?.status === 'number' && e2.status >= 500
          ? "We couldn't send the code right now — this looks like a temporary problem on our end. Please try again shortly."
          : 'Something went wrong sending the code. Please try again.'
        setError(getErrorMessage(err, fallback))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await verifyPasswordResetOtp(email, code)
      setStep('password')
    } catch (err) {
      logError('[ForgotPassword] verifyPasswordResetOtp failed:', err)
      const remaining = attemptsRemaining - 1
      setAttemptsRemaining(remaining)
      setCode('')
      if (remaining <= 0) {
        setError('Too many incorrect attempts. Request a new code to try again.')
      } else {
        // Supabase's verifyOtp deliberately returns the same generic
        // "Token has expired or is invalid" message whether the code
        // was simply wrong or genuinely expired or already used — it
        // doesn't distinguish, so this UI doesn't guess either.
        setError(`That code isn't right, has expired, or was already used. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!meetsMinimum) {
      setError('Choose a stronger password — see the requirements below.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      // The recovery session's one-time job is done — sign out so the
      // user lands on Login and authenticates fresh with the new
      // password, rather than lingering on a temporary recovery session.
      await signOut()
      setStep('success')
      setTimeout(
        () => navigate('/login', { state: { message: 'Password updated successfully. You can now log in.' } }),
        1500,
      )
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong updating your password. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const strength = scorePassword(password)
  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Upper and lowercase letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'At least one number', met: /\d/.test(password) },
  ]
  const meetsMinimum = requirements.every((r) => r.met)

  return (
    <section className="pt-36 pb-28 min-h-screen flex items-center">
      <div className="max-w-sm mx-auto px-6 w-full text-center">
        <Reveal>
          <div className="flex justify-center mb-5"><MonadMark size={40} /></div>

          {step === 'email' && (
            <>
              <h1 className="font-display font-semibold text-2xl mb-2">Forgot Password</h1>
              <p className="text-white/50 text-sm mb-8">Enter your email and we'll send you a 6-digit verification code.</p>
              <form onSubmit={requestCode} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Email</label>
                  <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
                </div>
                {error && <div className="text-sm text-rose-300">{error}</div>}
                <button type="submit" disabled={loading} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
                  {loading ? 'Sending…' : 'Send Code'}
                </button>
              </form>
              <Link to="/login" className="text-purple-light text-sm mt-6 inline-block">Back to login</Link>
            </>
          )}

          {step === 'code' && (
            <>
              <h1 className="font-display font-semibold text-2xl mb-2">Verify Code</h1>
              <p className="text-white/55 text-sm leading-relaxed mb-8">
                If an account exists for <span className="text-white">{email}</span>, a verification code has been sent — it expires in 10 minutes.
              </p>
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">6-digit code</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="000000"
                    maxLength={6}
                    className="input text-center tracking-[0.4em] font-mono text-lg"
                  />
                </div>
                {error && <div className="text-sm text-rose-300">{error}</div>}
                <button
                  type="submit"
                  disabled={loading || code.length !== 6 || attemptsRemaining <= 0}
                  className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>
                <button
                  type="button"
                  onClick={() => requestCode()}
                  disabled={cooldown > 0 || loading}
                  className="px-5 py-3 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-40"
                >
                  {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
                </button>
              </form>
              <Link to="/login" className="text-purple-light text-sm mt-6 inline-block">Back to login</Link>
            </>
          )}

          {step === 'password' && (
            <>
              <h1 className="font-display font-semibold text-2xl mb-2">Create New Password</h1>
              <p className="text-white/50 text-sm mb-8">Code verified. Choose a new password for your account.</p>

              <form onSubmit={handleSetPassword} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {password && (
                    <div className="mt-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_COLORS[strength] : 'bg-white/10'}`} />
                        ))}
                      </div>
                      <div className="text-[11px] text-white/40 mt-1.5">{STRENGTH_LABELS[strength]}</div>
                    </div>
                  )}

                  <ul className="mt-1 flex flex-col gap-1">
                    {requirements.map((r) => (
                      <li key={r.label} className={`text-[11px] flex items-center gap-1.5 ${r.met ? 'text-emerald-300' : 'text-white/35'}`}>
                        {r.met ? <Check size={11} /> : <X size={11} />} {r.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="input pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirm && confirm !== password && <div className="text-[11px] text-rose-300">Passwords don't match yet.</div>}
                </div>

                {error && <div className="text-sm text-rose-300">{error}</div>}

                <button type="submit" disabled={loading} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center">
                <Check size={24} />
              </div>
              <h1 className="font-display font-semibold text-2xl mb-2">Password updated</h1>
              <p className="text-white/55 text-sm leading-relaxed">Password updated successfully. You can now log in. Taking you to login…</p>
            </>
          )}
        </Reveal>
      </div>
    </section>
  )
}
