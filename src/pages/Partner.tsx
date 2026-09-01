import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Award, Building2, CalendarDays, GraduationCap, Handshake, Newspaper, Rocket, Send, UploadCloud, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PARTNERSHIP_TYPES } from '../types'
import Reveal from '../components/Reveal'
import { getErrorMessage, logError } from '../lib/errors'
import { notifyAdmin } from '../lib/notifyAdmin'

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
const MIN_FILL_TIME_MS = 4000

type Step = 'project' | 'details' | 'review'

interface Draft {
  project_name: string
  website: string
  x_username: string
  telegram: string
  contact_email: string
  contact_person: string
  category: string
  partnership_type: string
  description: string
  needs_from_us: string
  offers_to_us: string
  target_countries: string
  supporting_links: string
  additional_info: string
}

function emptyDraft(): Draft {
  return {
    project_name: '', website: '', x_username: '', telegram: '', contact_email: '', contact_person: '',
    category: '', partnership_type: PARTNERSHIP_TYPES[0], description: '', needs_from_us: '', offers_to_us: '',
    target_countries: '', supporting_links: '', additional_info: '',
  }
}

// Rewritten as a signed-in, 3-step application (see
// supabase/migrations/0037 and the "Partner With Us" spec) — the old
// anonymous single-step form wrote straight to partnership_submissions,
// which is now left untouched/historical. RequireAuth (App.tsx) gates
// this whole route, so `session`/`profile` below are always present.
export default function Partner() {
  const { session } = useAuth()
  const draftKey = `monad-africa-partner-draft-${session?.user.id}`

  const [step, setStep] = useState<Step>('project')
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = localStorage.getItem(draftKey)
      return saved ? { ...emptyDraft(), ...JSON.parse(saved) } : emptyDraft()
    } catch {
      return emptyDraft()
    }
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedAt = useRef(Date.now())

  // Autosave to localStorage — resumable if the tab closes mid-fill.
  // Cleared on successful submit below.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft))
      } catch {
        // best-effort only — private browsing / storage-full is fine to ignore
      }
    }, 800)
    return () => clearTimeout(t)
  }, [draft, draftKey])

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : null)
  }

  function validateProjectStep(): string | null {
    if (!draft.project_name.trim() || !draft.contact_email.trim() || !draft.contact_person.trim()) {
      return 'Please fill in your project name, contact email, and contact person.'
    }
    if (!EMAIL_RE.test(draft.contact_email.trim())) return 'Please enter a valid contact email address.'
    return null
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const honeypot = new FormData(e.currentTarget).get('company_url')
    if (honeypot) {
      // Bots fill every field, including this hidden one — pretend to
      // succeed without ever writing a row.
      setDone(true)
      return
    }
    if (Date.now() - mountedAt.current < MIN_FILL_TIME_MS) {
      setError('Please take a moment to review your entry before submitting.')
      return
    }

    const projectErr = validateProjectStep()
    if (projectErr) { setError(projectErr); setStep('project'); return }

    setSubmitting(true)
    try {
      let logo_url: string | null = null
      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('logos').upload(path, logoFile)
        if (uploadErr) throw uploadErr
        const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
        logo_url = pub.publicUrl
      }

      const { data: inserted, error: insertErr } = await supabase.from('partnership_applications').insert({
        created_by: session!.user.id,
        project_name: draft.project_name.trim(),
        logo_url,
        website: draft.website.trim() || null,
        x_username: draft.x_username.trim() || null,
        telegram: draft.telegram.trim() || null,
        contact_email: draft.contact_email.trim(),
        contact_person: draft.contact_person.trim(),
        category: draft.category.trim() || null,
        description: draft.description.trim() || null,
        partnership_type: draft.partnership_type,
        needs_from_us: draft.needs_from_us.trim() || null,
        offers_to_us: draft.offers_to_us.trim() || null,
        target_countries: draft.target_countries.split(',').map((c) => c.trim()).filter(Boolean),
        supporting_links: draft.supporting_links.trim() || null,
        additional_info: draft.additional_info.trim() || null,
      }).select('id').single()
      if (insertErr) throw insertErr

      try { localStorage.removeItem(draftKey) } catch { /* best-effort */ }
      if (inserted) notifyAdmin('partnership_application', inserted.id)
      setDone(true)
    } catch (err) {
      logError('[Partner] partnership application failed:', err)
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
            <h2 className="font-display font-semibold text-2xl mb-4">How partnership applications work</h2>
            <ol className="flex flex-col gap-4 text-sm text-white/55 leading-relaxed">
              <li><span className="text-purple-light font-mono mr-2">01</span>Submit your application using the form — your progress is saved as you go.</li>
              <li><span className="text-purple-light font-mono mr-2">02</span>Our Business Development lead, Crypto Testeer, reviews every application.</li>
              <li><span className="text-purple-light font-mono mr-2">03</span>We reach out via the email, Telegram, or X you provided to discuss next steps.</li>
            </ol>
            <p className="text-white/40 text-xs mt-6 leading-relaxed">
              Applications are reviewed by the Monad Africa team and are never published publicly.
            </p>
          </Reveal>

          <Reveal delay={100}>
            {done ? (
              <div className="rounded-squircle border border-white/10 bg-panel/60 p-12 text-center">
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
                <h3 className="font-display font-semibold text-2xl mb-2">Application received.</h3>
                <p className="text-white/55 max-w-md mx-auto leading-relaxed">
                  Thanks for reaching out — our Business Development team will review it and reach out to
                  you through email, Telegram, or X.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <StepIndicator step={step} />

                {/* Honeypot — hidden from real users via CSS, filled only by bots. */}
                <input type="text" name="company_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                {step === 'project' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Project / Organisation Name" value={draft.project_name} onChange={(v) => set('project_name', v)} required />
                    <Field label="Contact Person" value={draft.contact_person} onChange={(v) => set('contact_person', v)} required />
                    <Field label="Contact Email" value={draft.contact_email} onChange={(v) => set('contact_email', v)} type="email" required />
                    <Field label="Website" value={draft.website} onChange={(v) => set('website', v)} type="url" placeholder="https://" />
                    <Field label="X / Twitter Username" value={draft.x_username} onChange={(v) => set('x_username', v)} placeholder="@yourproject" />
                    <Field label="Telegram" value={draft.telegram} onChange={(v) => set('telegram', v)} placeholder="https://t.me/..." />
                    <Field label="Project Category" value={draft.category} onChange={(v) => set('category', v)} placeholder="DeFi, Infra, Gaming…" />

                    <div className="flex flex-col gap-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Project Logo</label>
                      <label className="input flex items-center gap-3 cursor-pointer">
                        <UploadCloud size={16} className="text-white/40 shrink-0" />
                        <span className="text-white/50 text-sm truncate">{logoFile ? logoFile.name : 'Choose an image file'}</span>
                        <input type="file" accept="image/*" onChange={onLogoChange} className="hidden" />
                      </label>
                      {logoPreview && <img src={logoPreview} alt="Logo preview" className="w-12 h-12 rounded-xl object-cover mt-1 border border-white/10" />}
                    </div>

                    {error && <div className="sm:col-span-2 text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}

                    <div className="sm:col-span-2 flex justify-end mt-1">
                      <button
                        type="button"
                        onClick={() => { const err = validateProjectStep(); if (err) { setError(err); return; } setError(null); setStep('details') }}
                        className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform"
                      >
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {step === 'details' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Type of Partnership Requested</label>
                      <select value={draft.partnership_type} onChange={(e) => set('partnership_type', e.target.value)} className="input">
                        {PARTNERSHIP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Short Project Description</label>
                      <textarea value={draft.description} onChange={(e) => set('description', e.target.value)} rows={3} className="input resize-y" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">What You Need From Monad Africa</label>
                      <textarea value={draft.needs_from_us} onChange={(e) => set('needs_from_us', e.target.value)} rows={3} className="input resize-y" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">What You Can Offer Monad Africa</label>
                      <textarea value={draft.offers_to_us} onChange={(e) => set('offers_to_us', e.target.value)} rows={3} className="input resize-y" />
                    </div>

                    <Field label="Target African Countries / Communities" value={draft.target_countries} onChange={(v) => set('target_countries', v)} placeholder="Nigeria, Kenya, Ghana… (comma-separated)" className="sm:col-span-2" />
                    <Field label="Supporting Links or Documents" value={draft.supporting_links} onChange={(v) => set('supporting_links', v)} placeholder="Deck, whitepaper, socials…" className="sm:col-span-2" />

                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Additional Information</label>
                      <textarea value={draft.additional_info} onChange={(e) => set('additional_info', e.target.value)} rows={2} className="input resize-y" />
                    </div>

                    <div className="sm:col-span-2 flex justify-between mt-1">
                      <button type="button" onClick={() => setStep('project')} className="px-6 py-3 rounded-full font-semibold border border-white/15 hover:bg-white/5 transition-colors">
                        ← Back
                      </button>
                      <button type="button" onClick={() => setStep('review')} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">
                        Review →
                      </button>
                    </div>
                  </div>
                )}

                {step === 'review' && (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-2 text-sm">
                      <ReviewRow label="Project" value={draft.project_name} />
                      <ReviewRow label="Contact" value={`${draft.contact_person} · ${draft.contact_email}`} />
                      <ReviewRow label="Partnership Type" value={draft.partnership_type} />
                      {draft.description && <ReviewRow label="Description" value={draft.description} />}
                    </div>

                    {error && <div className="text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}

                    <div className="flex justify-between mt-1">
                      <button type="button" onClick={() => setStep('details')} className="px-6 py-3 rounded-full font-semibold border border-white/15 hover:bg-white/5 transition-colors">
                        ← Back
                      </button>
                      <button type="submit" disabled={submitting} className="px-8 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
                        {submitting ? 'Submitting…' : 'Submit Application →'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function StepIndicator({ step }: { step: Step }) {
  const steps: [Step, string][] = [['project', 'Project & Contact'], ['details', 'Partnership Details'], ['review', 'Review & Submit']]
  return (
    <div className="flex items-center gap-2 mb-1">
      {steps.map(([key, label], i) => (
        <div key={key} className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold border ${
            step === key ? 'bg-purple border-purple text-white' : 'border-white/20 text-white/40'
          }`}>{i + 1}</span>
          <span className={`text-xs hidden sm:inline ${step === key ? 'text-white' : 'text-white/35'}`}>{label}</span>
          {i < steps.length - 1 && <span className="w-6 h-px bg-white/15 mx-1" />}
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">{label}</span>
      <p className="text-white/75 mt-0.5 whitespace-pre-line">{value}</p>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder, className = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label} {required && <span className="text-purple-light">*</span>}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} required={required} placeholder={placeholder} className="input" />
    </div>
  )
}
