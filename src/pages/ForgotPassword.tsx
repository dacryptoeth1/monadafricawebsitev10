import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'

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
    } catch {
      setError('Something went wrong. Double check the email and try again.')
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
