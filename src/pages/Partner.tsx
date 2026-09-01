import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Building2, CalendarDays, GraduationCap, Handshake, Newspaper, Rocket, Send, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PARTNERSHIP_TYPES } from '../types'
import Reveal from '../components/Reveal'
import { getErrorMessage, logError } from '../lib/errors'

const OPPORTUNITIES = [
  { Icon: Handshake, label: 'Ecosystem Partnerships' },
  { Icon: Users, label: 'Community Collaborations' },
  { Icon: Award, label: 'Sponsorships' },
  { Icon: GraduationCap, label: 'University Programmes' },
  { Icon: Rocket, label: 'Hackathons & Builder Programmes' },
  { Icon: CalendarDays, label: 'Events' },
  { Icon: Newspaper, label: 'Media Partnerships' },
  { Icon: Building2, label: 'Project Collaborations' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Partner() {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const data = new FormData(form)

    const full_name = String(data.get('full_name') || '').trim()
    const organization = String(data.get('organization') || '').trim()
    const email = String(data.get('email') || '').trim()
    const x_url = String(data.get('x_url') || '').trim()
    const telegram = String(data.get('telegram') || '').trim()
    const website = String(data.get('website') || '').trim()
    const partnership_type = String(data.get('partnership_type') || 'Other')
    const message = String(data.get('message') || '').trim()

    if (!full_name || !email || !message) {
      setError('Please fill in your name, email, and a short message about your proposal.')
      return
    }
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const { error: insertErr } = await supabase.from('partnership_submissions').insert({
        full_name,
        organization: organization || null,
        email,
        x_url: x_url || null,
        telegram: telegram || null,
        website: website || null,
        partnership_type,
        message,
      })
      if (insertErr) throw insertErr

      setDone(true)
      form.reset()
    } catch (err) {
      logError('[Partner] partnership submission failed:', err)
      setError(getErrorMessage(err, 'Something went wrong submitting this — please try again in a moment.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="max-w-2xl mb-16">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Partner With Us</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-5">
            Partner with Monad Africa.
          </h1>
          <p className="text-white/55 leading-relaxed">
            Monad Africa is open to ecosystem partnerships, community collaborations, sponsorships,
            university programmes, hackathons, builder programmes, events, media partnerships, project
            collaborations, and other strategic ecosystem opportunities. Tell us about yours below, or
            reach our Business Development lead directly.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <a
              href="https://t.me/CryptoTesteer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform"
            >
              <Send size={15} /> Contact Lead BD
            </a>
            <Link to="/team#business-development" className="px-6 py-3 rounded-full font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
              Meet the BD Team
            </Link>
          </div>
        </Reveal>

        <Reveal className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
          {OPPORTUNITIES.map(({ Icon, label }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
              <Icon size={18} className="mx-auto mb-3 text-purple-light" />
              <span className="text-xs text-white/60 leading-snug">{label}</span>
            </div>
          ))}
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.4fr] gap-12">
          <Reveal>
            <h2 className="font-display font-semibold text-2xl mb-4">How partnership enquiries work</h2>
            <ol className="flex flex-col gap-4 text-sm text-white/55 leading-relaxed">
              <li><span className="text-purple-light font-mono mr-2">01</span>Submit your proposal using the form.</li>
              <li><span className="text-purple-light font-mono mr-2">02</span>Our Business Development lead, Crypto Testeer, reviews every submission.</li>
              <li><span className="text-purple-light font-mono mr-2">03</span>We reach out via the email or Telegram you provide to discuss next steps.</li>
            </ol>
            <p className="text-white/40 text-xs mt-6 leading-relaxed">
              Submissions are reviewed by the Monad Africa team and are not publicly visible.
            </p>
          </Reveal>

          <Reveal delay={100}>
            {done ? (
              <div className="rounded-squircle border border-white/10 bg-panel/60 p-12 text-center">
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
                <h3 className="font-display font-semibold text-2xl mb-2">Proposal received.</h3>
                <p className="text-white/55 max-w-md mx-auto leading-relaxed">
                  Thanks for reaching out — our Business Development team will review it and get back to
                  you at the contact details you provided.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" name="full_name" required />
                <Field label="Project / Organisation" name="organization" />
                <Field label="Email" name="email" type="email" required />
                <Field label="Website" name="website" type="url" placeholder="https://" />
                <Field label="X / Twitter" name="x_url" placeholder="https://x.com/..." />
                <Field label="Telegram" name="telegram" placeholder="https://t.me/..." />

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Partnership Type</label>
                  <select name="partnership_type" required className="input" defaultValue={PARTNERSHIP_TYPES[0]}>
                    {PARTNERSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">
                    Proposal / Message <span className="text-purple-light">*</span>
                  </label>
                  <textarea name="message" required rows={5} className="input resize-y" placeholder="Tell us about your project and what you have in mind." />
                </div>

                {error && <div className="sm:col-span-2 text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}

                <div className="sm:col-span-2 flex justify-center mt-2">
                  <button type="submit" disabled={submitting} className="px-8 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
                    {submitting ? 'Submitting…' : 'Submit Proposal →'}
                  </button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Field({ label, name, type = 'text', required, placeholder, className = '' }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label} {required && <span className="text-purple-light">*</span>}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} className="input" />
    </div>
  )
}
