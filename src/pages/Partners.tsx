import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Handshake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { notifyAdmin } from '../lib/notifyAdmin'
import { getErrorMessage, logError } from '../lib/errors'
import type { Partner } from '../types'
import Reveal from '../components/Reveal'
import { BusinessInquirySection } from '../components/BusinessInquiry'
import EmptyState from '../components/EmptyState'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_FILL_TIME_MS = 4000

// A separate, smaller taxonomy from types.ts' PARTNERSHIP_TYPES (used
// by the older, richer /partner application wizard) — partnership_type
// is a plain text column with no CHECK constraint, so a second, leaner
// list here is safe and doesn't affect that other flow.
const PROPOSAL_TYPES = ['Partnership', 'Collaboration', 'Sponsorship', 'Community Activation', 'Event', 'Integration', 'Other'] as const

export default function Partners() {
  const location = useLocation()
  const [partners, setPartners] = useState<Partner[] | null>(null)

  useEffect(() => {
    supabase.from('partners').select('*').order('created_at', { ascending: false }).then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [])

  // "Partner with Us" CTAs sitewide (Home, Dashboard, Team, etc.) link
  // straight to /partners#partner-form now — this makes that landing
  // immediately scroll to the form itself, so there's no intermediate
  // "find the form" step even though it isn't the very first thing on
  // the page (the partner-logo showcase and team card come first).
  // Both #partner-form and #business-inquiries land on this page, and
  // ScrollToTop leaves hash navigation to the destination page — so the
  // page scrolls itself to whichever section was asked for.
  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Partners</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-14 max-w-xl">Building this ecosystem together.</h1>
        </Reveal>

        <Reveal className="flex flex-wrap items-center gap-5 mb-4">
          <div className="flex items-center gap-2 px-6 py-4 rounded-full border border-white/15 font-display font-semibold">
            <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-glow to-purple" /> Monad
          </div>
        </Reveal>

        {partners === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-full border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : partners.length === 0 ? (
          <div className="mt-10">
            <EmptyState Icon={Handshake} message="No community partners listed yet." />
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 mt-6">
            {partners.map((p, i) => {
              const body = (
                <>
                  {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="w-6 h-6 rounded object-cover" /> : <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-glow to-purple" />}
                  {p.name}
                </>
              )
              // A partner with no website is still shown — just as a
              // plain badge rather than a link to "#".
              const base = 'flex items-center gap-3 px-6 py-4 rounded-full border border-white/15 font-display font-semibold'
              return (
                <Reveal key={p.id} delay={i * 50}>
                  {p.website ? (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className={`${base} hover:border-gold/40 hover:-translate-y-0.5 transition-all`}>{body}</a>
                  ) : (
                    <div className={base}>{body}</div>
                  )}
                </Reveal>
              )
            })}
          </div>
        )}

        {/* The commercial front door: sponsorships, media, ecosystem
            initiatives. Reachable from the Partners nav dropdown and
            the footer (both of which open the same content as a modal),
            and directly linkable as /partners#business-inquiries. */}
        <Reveal className="mt-24 pt-24 border-t border-white/10">
          <BusinessInquirySection />
        </Reveal>

        {/* This page is deliberately partnerships-focused, not a place
            to feature team members — the roster lives at /team. A prior
            version showed a team member card here; removed per explicit
            request so this page reads as purely "propose a
            partnership," nothing else. */}
        <div id="partner-form" className="mt-24 pt-24 border-t border-white/10 scroll-mt-28">
          <Reveal className="mb-10">
            <span className="font-mono text-xs uppercase tracking-wider text-gold">Work with us</span>
            <h2 className="font-display font-semibold text-3xl md:text-4xl mt-4 mb-4 max-w-xl">Partner with Monad Africa</h2>
            <p className="text-white/55 max-w-xl leading-relaxed">
              Building something you'd like to bring to the African Monad community? Tell us about your
              project, partnership idea, or collaboration.
            </p>
          </Reveal>

          <ProposalForm />
        </div>
      </div>
    </section>
  )
}

interface ProposalDraft {
  full_name: string
  email: string
  project_name: string
  x_handle: string
  partnership_type: string
  message: string
  website: string
  telegram_discord: string
  project_description: string
  additional_links: string
}

function emptyProposal(): ProposalDraft {
  return {
    full_name: '', email: '', project_name: '', x_handle: '', partnership_type: PROPOSAL_TYPES[0], message: '',
    website: '', telegram_discord: '', project_description: '', additional_links: '',
  }
}

// The Partners page's own proposal mechanism — separate from, and
// simpler than, the older signed-in 3-step /partner wizard (which
// stays untouched for anyone who lands there directly). Writes to the
// SAME partnership_applications table and triggers the SAME
// notify-admin email pipeline — reusing the real architecture, not a
// second system. Field mapping onto that table's existing columns
// (no schema change): full_name -> contact_person, x_handle ->
// x_username, telegram_discord -> telegram, message (the required
// "Proposal / Message") -> description, project_description (the
// optional field of that name) -> additional_info, additional_links ->
// supporting_links.
function ProposalForm() {
  const { session } = useAuth()
  const [draft, setDraft] = useState<ProposalDraft>(emptyProposal())
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [emailFailed, setEmailFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedAt = useRef(Date.now())

  function set<K extends keyof ProposalDraft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function validate(): string | null {
    if (!draft.full_name.trim() || !draft.email.trim() || !draft.project_name.trim() || !draft.x_handle.trim() || !draft.message.trim()) {
      return 'Please fill in your name, email, project/organization name, X/Twitter handle, and proposal.'
    }
    if (!EMAIL_RE.test(draft.email.trim())) return 'Please enter a valid email address.'
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
      setError('Please take a moment to review your proposal before submitting.')
      return
    }
    const err = validate()
    if (err) { setError(err); return }
    if (!session) { setError('Please sign in to submit a proposal.'); return }

    setSubmitting(true)
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('partnership_applications')
        .insert({
          created_by: session.user.id,
          project_name: draft.project_name.trim(),
          contact_person: draft.full_name.trim(),
          contact_email: draft.email.trim(),
          x_username: draft.x_handle.trim(),
          partnership_type: draft.partnership_type,
          description: draft.message.trim(),
          website: draft.website.trim() || null,
          telegram: draft.telegram_discord.trim() || null,
          additional_info: draft.project_description.trim() || null,
          supporting_links: draft.additional_links.trim() || null,
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr

      // The submission is already safely stored at this point — an
      // email failure below never removes or hides it, it only affects
      // whether we show the honest "email didn't go out" note.
      const emailed = inserted ? await notifyAdmin('partnership_application', inserted.id) : false
      setEmailFailed(!emailed)
      setDone(true)
    } catch (err) {
      logError('[Partners] proposal submission failed:', err)
      setError(getErrorMessage(err, 'Something went wrong submitting this — please try again in a moment.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <Reveal>
        <div className="rounded-squircle border border-white/10 bg-panel/60 p-12 text-center max-w-2xl">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
          <h3 className="font-display font-semibold text-2xl mb-2">Proposal received.</h3>
          <p className="text-white/55 max-w-md mx-auto leading-relaxed">
            Thanks for reaching out — the Monad Africa team will review it and get back to you at the
            email you provided.
          </p>
          {emailFailed && (
            <p className="text-amber-300/70 text-xs max-w-md mx-auto leading-relaxed mt-4">
              Your proposal is safely saved. Our email notification didn't go through just now, so a
              response may take a little longer than usual — no action needed on your end.
            </p>
          )}
        </div>
      </Reveal>
    )
  }

  if (!session) {
    return (
      <Reveal>
        <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-10 text-center max-w-xl">
          <p className="text-white/60 mb-5">Please sign in to submit a partnership proposal.</p>
          <Link to="/login" state={{ from: '/partners' }} className="inline-flex px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">
            Sign in →
          </Link>
        </div>
      </Reveal>
    )
  }

  return (
    <Reveal>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
        {/* Honeypot — hidden from real users via CSS, filled only by bots. */}
        <input type="text" name="company_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" value={draft.full_name} onChange={(v) => set('full_name', v)} required />
          <Field label="Email Address" value={draft.email} onChange={(v) => set('email', v)} type="email" required />
          <Field label="Project / Organization Name" value={draft.project_name} onChange={(v) => set('project_name', v)} required />
          <Field label="X / Twitter Handle" value={draft.x_handle} onChange={(v) => set('x_handle', v)} placeholder="@yourproject" required />

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Partnership Type <span className="text-purple-light">*</span></label>
            <select value={draft.partnership_type} onChange={(e) => set('partnership_type', e.target.value)} className="input" required>
              {PROPOSAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Field label="Website" value={draft.website} onChange={(v) => set('website', v)} type="url" placeholder="https://" />
          <Field label="Telegram / Discord" value={draft.telegram_discord} onChange={(v) => set('telegram_discord', v)} placeholder="https://t.me/… or a Discord handle" />

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Project Description</label>
            <textarea value={draft.project_description} onChange={(e) => set('project_description', e.target.value)} rows={3} className="input resize-y" />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Proposal / Message <span className="text-purple-light">*</span></label>
            <textarea value={draft.message} onChange={(e) => set('message', e.target.value)} rows={5} className="input resize-y" required />
          </div>

          <Field label="Additional Links" value={draft.additional_links} onChange={(v) => set('additional_links', v)} placeholder="Deck, whitepaper, socials…" className="sm:col-span-2" />
        </div>

        {error && <div className="text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}

        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="px-8 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
            {submitting ? 'Submitting…' : 'Submit Proposal →'}
          </button>
        </div>
      </form>
    </Reveal>
  )
}

function Field({
  label, value, onChange, type = 'text', required, placeholder, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label} {required && <span className="text-purple-light">*</span>}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} required={required} placeholder={placeholder} className="input" />
    </div>
  )
}
