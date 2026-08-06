import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate(location.state?.from || '/dashboard')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen flex items-center">
      <div className="max-w-sm mx-auto px-6 w-full">
        <Reveal>
          <h1 className="font-display font-semibold text-3xl mb-2 text-center">Welcome back</h1>
          <p className="text-white/50 text-sm text-center mb-10">Log in to your Monad Africa account</p>

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
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </div>
            {error && <div className="text-sm text-rose-300">{error}</div>}
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
