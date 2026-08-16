import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Reveal from '../components/Reveal'
import MonadMark from '../components/MonadMark'

// The password-reset email links here with a Supabase recovery token in
// the URL (either a `#access_token=...&type=recovery` hash, or a
// `?code=...` PKCE param, depending on the project's Auth flow setting).
// supabase-js's `detectSessionInUrl` (on by default, see src/lib/supabase.ts)
// picks either form up automatically and turns it into a real session —
// we just need to wait for that to land before letting the user submit a
// new password, and tell them clearly if it never does (expired/already
// used link).
type RecoveryStatus = 'checking' | 'ready' | 'invalid'

function scorePassword(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4) // 0-4
}

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['bg-rose-400', 'bg-rose-400', 'bg-amber-400', 'bg-gold', 'bg-emerald-400']

export default function ResetPassword() {
  const navigate = useNavigate()
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Detect the recovery session Supabase establishes from the link's
  // token. onAuthStateChange fires PASSWORD_RECOVERY as soon as
  // supabase-js finishes parsing the URL; getSession() is a fallback in
  // case that already happened before this component mounted. If
  // neither produces a session within a few seconds, the link is
  // missing, expired, or already used.
  useEffect(() => {
    let settled = false

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        settled = true
        setRecoveryStatus('ready')
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (!settled && data.session) {
        settled = true
        setRecoveryStatus('ready')
      }
    })

    const timeout = setTimeout(() => {
      if (!settled) setRecoveryStatus('invalid')
    }, 3000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const strength = scorePassword(password)
  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Upper and lowercase letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'At least one number', met: /\d/.test(password) },
  ]
  const meetsMinimum = requirements.every((r) => r.met)

  async function handleSubmit(e: FormEvent) {
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
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr

      // Recovery session's one-time job is done — sign out so the user
      // lands on Login and authenticates fresh with the new password,
      // rather than lingering on a temporary recovery session.
      await supabase.auth.signOut()

      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong updating your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen flex items-center">
      <div className="max-w-sm mx-auto px-6 w-full text-center">
        <Reveal>
          <div className="flex justify-center mb-5"><MonadMark size={40} /></div>

          {recoveryStatus === 'checking' && (
            <>
              <h1 className="font-display font-semibold text-2xl mb-2">Verifying your link…</h1>
              <p className="text-white/50 text-sm">Hang tight for a moment.</p>
            </>
          )}

          {recoveryStatus === 'invalid' && (
            <>
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-rose-400/15 border border-rose-400/25 flex items-center justify-center text-2xl">
                <X className="text-rose-300" size={24} />
              </div>
              <h1 className="font-display font-semibold text-2xl mb-2">This link isn't valid</h1>
              <p className="text-white/55 text-sm leading-relaxed mb-8">
                It may have expired or already been used. Request a fresh password reset link and try again.
              </p>
              <Link
                to="/forgot-password"
                className="inline-block px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform"
              >
                Request a new link
              </Link>
            </>
          )}

          {recoveryStatus === 'ready' && done && (
            <>
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">
                <Check size={24} />
              </div>
              <h1 className="font-display font-semibold text-2xl mb-2">Password updated</h1>
              <p className="text-white/55 text-sm">Taking you to login…</p>
            </>
          )}

          {recoveryStatus === 'ready' && !done && (
            <>
              <h1 className="font-display font-semibold text-2xl mb-2">Set a new password</h1>
              <p className="text-white/50 text-sm mb-8">Choose a new password for your account.</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
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
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH_COLORS[strength] : 'bg-white/10'}`}
                          />
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
                  {confirm && confirm !== password && (
                    <div className="text-[11px] text-rose-300">Passwords don't match yet.</div>
                  )}
                </div>

                {error && <div className="text-sm text-rose-300">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform"
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </Reveal>
      </div>
    </section>
  )
}
