import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import PasswordField from '../components/PasswordField'
import CountrySelect from '../components/CountrySelect'
import MonadMark from '../components/MonadMark'
import { USER_ROLES, normalizeUserRole } from '../lib/userRole'
import { getErrorMessage, logError } from '../lib/errors'

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

    // profiles.role has a CHECK constraint (profiles_role_check) that
    // only accepts the exact USER_ROLES strings, or NULL — never an
    // empty/unrecognized value. The <select> below is built from
    // USER_ROLES so this should always normalize cleanly; if it
    // somehow doesn't, block submission here rather than let the
    // signup trigger insert an invalid role and fail server-side.
    const normalizedRole = normalizeUserRole(String(data.get('role') || ''))
    if (!normalizedRole) {
      setError('Please select a valid role.')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password, {
        full_name: String(data.get('full_name') || ''),
        username: String(data.get('username') || ''),
        country: countryName,
        role: normalizedRole,
        referredByCode: refCode,
      })
      setDone(true)
    } catch (err) {
      logError('[Signup] signUp failed:', err)
      setError(getErrorMessage(err, 'Something went wrong creating your account. Please try again in a moment.'))
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
            <PasswordField label="Password" name="password" required autoComplete="new-password" />

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
                {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
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
