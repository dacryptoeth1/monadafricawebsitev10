import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import SocialAuthButtons from '../components/SocialAuthButtons'
import CountrySelect from '../components/CountrySelect'
import MonadMark from '../components/MonadMark'
import type { UserRole } from '../types'

const ROLES: UserRole[] = ['Developer', 'Designer', 'Content Creator', 'Community Member', 'Founder', 'Student']

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const refCode = params.get('ref') || ''

  const [countryIso, setCountryIso] = useState('')
  const [countryName, setCountryName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const data = new FormData(e.currentTarget)
    const email = String(data.get('email') || '')
    const password = String(data.get('password') || '')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!countryName) {
      setError('Please select your country.')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, {
        full_name: String(data.get('full_name') || ''),
        username: String(data.get('username') || ''),
        country: countryName,
        role: String(data.get('role') || ''),
        referredByCode: refCode,
      })
      setDone(true)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong creating your account.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <section className="pt-36 pb-28 min-h-screen flex items-center">
        <div className="max-w-sm mx-auto px-6 text-center">
          <Reveal>
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
            <h1 className="font-display font-semibold text-2xl mb-3">Check your email</h1>
            <p className="text-white/55 text-sm leading-relaxed mb-8">
              We've sent a verification link to confirm your account. Click it, then come back
              and log in.
            </p>
            <Link to="/login" className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple inline-block">
              Go to Login
            </Link>
          </Reveal>
        </div>
      </section>
    )
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-md mx-auto px-6">
        <Reveal>
          <div className="flex justify-center mb-5"><MonadMark size={40} /></div>
          <h1 className="font-display font-semibold text-3xl mb-2 text-center">Join Monad Africa</h1>
          <p className="text-white/50 text-sm text-center mb-10">Create your builder account</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Full Name" name="full_name" required />
            <Field label="Username" name="username" required />
            <Field label="Email" name="email" type="email" required />
            <Field label="Password" name="password" type="password" required />

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Country</label>
              <CountrySelect
                value={countryIso}
                required
                onChange={(iso, name) => {
                  setCountryIso(iso)
                  setCountryName(name)
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Role</label>
              <select name="role" required className="input" defaultValue="Developer">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {refCode && (
              <div className="text-xs text-purple-light bg-purple/10 border border-purple/25 rounded-xl px-4 py-2.5">
                Referred by code <span className="font-mono">{refCode}</span>
              </div>
            )}

            {error && <div className="text-sm text-rose-300">{error}</div>}

            <button type="submit" disabled={loading} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6">
            <SocialAuthButtons />
          </div>

          <p className="text-center text-sm text-white/40 mt-8">
            Already have an account? <Link to="/login" className="text-purple-light hover:text-white transition-colors">Log in</Link>
          </p>
        </Reveal>
      </div>
    </section>
  )
}

function Field({ label, name, type = 'text', required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input name={name} type={type} required={required} className="input" />
    </div>
  )
}
