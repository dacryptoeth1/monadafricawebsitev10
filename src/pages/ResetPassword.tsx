import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch {
      setError('This reset link may have expired — request a new one from the Forgot Password page.')
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
              <h1 className="font-display font-semibold text-2xl mb-2">Password updated</h1>
              <p className="text-white/55 text-sm">Taking you to your dashboard…</p>
            </>
          ) : (
            <>
              <h1 className="font-display font-semibold text-2xl mb-2">Set a new password</h1>
              <p className="text-white/50 text-sm mb-8">Choose a new password for your account.</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">New Password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Confirm Password</label>
                  <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
                </div>
                {error && <div className="text-sm text-rose-300">{error}</div>}
                <button type="submit" disabled={loading} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
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
