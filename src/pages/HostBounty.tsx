import { useEffect, useRef, useState, type FormEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { BountyCategory, BountyHostingRequest } from '../types'
import Reveal from '../components/Reveal'
import { getErrorMessage, logError } from '../lib/errors'
import { notifyAdmin } from '../lib/notifyAdmin'

const CATEGORIES: BountyCategory[] = ['Development', 'Design', 'Marketing', 'Community', 'Content']
const MIN_FILL_TIME_MS = 4000
const AUTOSAVE_DEBOUNCE_MS = 1500

type Step = 'project' | 'bounty' | 'rewards' | 'contact' | 'review'
const STEPS: [Step, string][] = [
  ['project', 'Project Info'],
  ['bounty', 'Bounty Details'],
  ['rewards', 'Rewards & Deadline'],
  ['contact', 'Contact Info'],
  ['review', 'Review & Submit'],
]

interface Draft {
  project_name: string
  website: string
  x_username: string
  title: string
  description: string
  category: BountyCategory
  required_skills: string
  eligibility: string
  deliverables: string
  num_winners: string
  total_reward: string
  reward_currency: string
  reward_distribution: string
  submission_deadline: string
  winner_announcement_date: string
  payment_method: string
  telegram: string
  contact_email: string
  contact_person: string
  relevant_links: string
  terms: string
  additional_info: string
}

function emptyDraft(): Draft {
  return {
    project_name: '', website: '', x_username: '', title: '', description: '', category: 'Development',
    required_skills: '', eligibility: '', deliverables: '', num_winners: '1', total_reward: '', reward_currency: '',
    reward_distribution: '', submission_deadline: '', winner_announcement_date: '', payment_method: '',
    telegram: '', contact_email: '', contact_person: '', relevant_links: '', terms: '', additional_info: '',
  }
}

function draftFromRow(r: BountyHostingRequest): Draft {
  return {
    project_name: r.project_name ?? '', website: r.website ?? '', x_username: r.x_username ?? '',
    title: r.title ?? '', description: r.description ?? '', category: r.category ?? 'Development',
    required_skills: r.required_skills ?? '', eligibility: r.eligibility ?? '', deliverables: r.deliverables ?? '',
    num_winners: r.num_winners ? String(r.num_winners) : '1', total_reward: r.total_reward ?? '',
    reward_currency: r.reward_currency ?? '', reward_distribution: r.reward_distribution ?? '',
    submission_deadline: r.submission_deadline ?? '', winner_announcement_date: r.winner_announcement_date ?? '',
    payment_method: r.payment_method ?? '', telegram: r.telegram ?? '', contact_email: r.contact_email ?? '',
    contact_person: r.contact_person ?? '', relevant_links: r.relevant_links ?? '', terms: r.terms ?? '',
    additional_info: r.additional_info ?? '',
  }
}

// Rewritten as a signed-in, 5-step "Host a Bounty" application (see
// supabase/migrations/0037) — replaces the old flow that inserted
// directly into the public `bounties` table. This now inserts into
// bounty_hosting_requests as a real, resumable draft row (autosaved as
// the user fills each step) and only reaches the public bounty board
// once an admin approves and publishes it. RequireAuth (App.tsx) gates
// this whole route.
export default function HostBounty() {
  const { session } = useAuth()

  const [loadingExisting, setLoadingExisting] = useState(true)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [existingStatus, setExistingStatus] = useState<BountyHostingRequest['status'] | null>(null)
  const [adminNotes, setAdminNotes] = useState<string | null>(null)

  const [step, setStep] = useState<Step>('project')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedAt = useRef(Date.now())
  const startedTyping = useRef(false)

  // Resume an in-progress request (draft, pending review, or changes
  // requested — the DB only ever allows one open at a time per user,
  // see reject_duplicate_bounty_hosting_request in migration 0037).
  useEffect(() => {
    if (!session) return
    supabase
      .from('bounty_hosting_requests')
      .select('*')
      .eq('created_by', session.user.id)
      .in('status', ['draft', 'pending_review', 'changes_requested'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as BountyHostingRequest | null
        if (row) {
          setRequestId(row.id)
          setExistingStatus(row.status)
          setAdminNotes(row.admin_notes)
          setDraft(draftFromRow(row))
          setLogoUrl(row.logo_url)
          setProofUrl(row.proof_of_funds_url)
          startedTyping.current = true
        }
        setLoadingExisting(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id])

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    startedTyping.current = true
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : null)
  }
  function onProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    setProofFile(e.target.files?.[0] ?? null)
  }

  // Debounced draft autosave into the DB — resumable across devices,
  // not just this browser. Only starts once the user has actually typed
  // something (avoids creating an empty row on a bare page visit).
  useEffect(() => {
    if (!session || !startedTyping.current || existingStatus === 'pending_review') return
    setSaveState('saving')
    const t = setTimeout(async () => {
      const payload = {
        project_name: draft.project_name.trim() || null,
        website: draft.website.trim() || null,
        x_username: draft.x_username.trim() || null,
        title: draft.title.trim() || null,
        description: draft.description.trim() || null,
        category: draft.category,
        required_skills: draft.required_skills.trim() || null,
        eligibility: draft.eligibility.trim() || null,
        deliverables: draft.deliverables.trim() || null,
        num_winners: draft.num_winners ? parseInt(draft.num_winners, 10) || null : null,
        total_reward: draft.total_reward.trim() || null,
        reward_currency: draft.reward_currency.trim() || null,
        reward_distribution: draft.reward_distribution.trim() || null,
        submission_deadline: draft.submission_deadline || null,
        winner_announcement_date: draft.winner_announcement_date || null,
        payment_method: draft.payment_method.trim() || null,
        telegram: draft.telegram.trim() || null,
        contact_email: draft.contact_email.trim() || null,
        contact_person: draft.contact_person.trim() || null,
        relevant_links: draft.relevant_links.trim() || null,
        terms: draft.terms.trim() || null,
        additional_info: draft.additional_info.trim() || null,
      }
      try {
        if (requestId) {
          const { error: updErr } = await supabase.from('bounty_hosting_requests').update(payload).eq('id', requestId)
          if (updErr) throw updErr
        } else {
          const { data, error: insErr } = await supabase
            .from('bounty_hosting_requests')
            .insert({ ...payload, created_by: session.user.id })
            .select('id')
            .single()
          if (insErr) throw insErr
          setRequestId(data.id)
        }
        setSaveState('saved')
      } catch (err) {
        logError('[HostBounty] draft autosave failed:', err)
        setSaveState('idle')
      }
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, requestId, session?.user.id])

  async function uploadIfNeeded() {
    if (logoFile) {
      const ext = logoFile.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('logos').upload(path, logoFile)
      if (uploadErr) throw uploadErr
      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
      setLogoUrl(pub.publicUrl)
      return pub.publicUrl
    }
    return logoUrl
  }
  async function uploadProofIfNeeded() {
    if (proofFile && session) {
      const ext = proofFile.name.split('.').pop()
      const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('bounty_documents').upload(path, proofFile)
      if (uploadErr) throw uploadErr
      setProofUrl(path)
      return path
    }
    return proofUrl
  }

  function stepError(s: Step): string | null {
    if (s === 'project' && !draft.project_name.trim()) return 'Please enter your project name.'
    if (s === 'bounty' && (!draft.title.trim() || !draft.description.trim())) return 'Please enter a bounty title and description.'
    if (s === 'rewards') {
      if (!draft.total_reward.trim() || !draft.reward_currency.trim()) return 'Please enter the total reward and its currency.'
      if (!draft.submission_deadline) return 'Please set a submission deadline.'
      if (!parseInt(draft.num_winners, 10) || parseInt(draft.num_winners, 10) < 1) return 'Number of winners must be at least 1.'
    }
    if (s === 'contact') {
      if (!draft.contact_email.trim() || !draft.contact_person.trim()) return 'Please enter a contact email and contact person.'
    }
    return null
  }

  function goNext() {
    const err = stepError(step)
    if (err) { setError(err); return }
    setError(null)
    const i = STEPS.findIndex(([k]) => k === step)
    setStep(STEPS[i + 1][0])
  }
  function goBack() {
    const i = STEPS.findIndex(([k]) => k === step)
    setStep(STEPS[i - 1][0])
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const honeypot = new FormData(e.currentTarget).get('company_url')
    if (honeypot) { setDone(true); return }
    if (Date.now() - mountedAt.current < MIN_FILL_TIME_MS) {
      setError('Please take a moment to review your entry before submitting.')
      return
    }
    for (const [s] of STEPS) {
      if (s === 'review') continue
      const err = stepError(s)
      if (err) { setError(err); setStep(s); return }
    }
    if (!requestId) { setError('Please fill in the form before submitting.'); return }

    setSubmitting(true)
    try {
      const logo_url = await uploadIfNeeded()
      const proof_of_funds_url = await uploadProofIfNeeded()
      const { error: updErr } = await supabase
        .from('bounty_hosting_requests')
        .update({
          logo_url,
          proof_of_funds_url,
          num_winners: parseInt(draft.num_winners, 10) || 1,
          status: 'pending_review',
        })
        .eq('id', requestId)
      if (updErr) throw updErr

      notifyAdmin('bounty_hosting_request', requestId)
      setDone(true)
    } catch (err) {
      logError('[HostBounty] bounty request submission failed:', err)
      setError(getErrorMessage(err, 'Something went wrong submitting this — please try again in a moment.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal className="text-center mb-12">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Host a bounty</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">Reach Africa's builders.</h1>
          <p className="text-white/55 max-w-lg mx-auto">
            Submit your bounty application below. Our team reviews every request before it goes live —
            approved bounties get published with a Verified by Monad Africa badge.
          </p>
        </Reveal>

        {loadingExisting ? (
          <div className="text-white/40 text-sm text-center py-10">Loading…</div>
        ) : done || existingStatus === 'pending_review' ? (
          <Reveal>
            <div className="rounded-squircle border border-white/10 bg-panel/60 p-14 text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
              <h2 className="font-display font-semibold text-2xl mb-2">
                {done ? 'Bounty request submitted for review.' : 'Your bounty request is under review.'}
              </h2>
              <p className="text-white/55 max-w-md mx-auto leading-relaxed">
                We'll review it shortly and reach out at the contact email you provided. Once approved,
                we'll publish it to the public bounty board with a verification badge.
              </p>
            </div>
          </Reveal>
        ) : (
          <Reveal>
            {existingStatus === 'changes_requested' && (
              <div className="mb-6 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-sm text-amber-200/90">
                <span className="font-semibold">The Monad Africa team requested changes:</span>
                <p className="mt-1 whitespace-pre-line">{adminNotes || 'Please review and resubmit.'}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <StepIndicator step={step} />
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved' : ''}
                </span>
              </div>

              <input type="text" name="company_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

              {step === 'project' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Project Name" value={draft.project_name} onChange={(v) => set('project_name', v)} required />
                  <Field label="Website" value={draft.website} onChange={(v) => set('website', v)} type="url" />
                  <Field label="Project X (Twitter)" value={draft.x_username} onChange={(v) => set('x_username', v)} placeholder="@yourproject" />

                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Project Logo</label>
                    <label className="input flex items-center gap-3 cursor-pointer">
                      <UploadCloud size={16} className="text-white/40 shrink-0" />
                      <span className="text-white/50 text-sm truncate">{logoFile ? logoFile.name : logoUrl ? 'Logo uploaded' : 'Choose an image file'}</span>
                      <input type="file" accept="image/*" onChange={onLogoChange} className="hidden" />
                    </label>
                    {(logoPreview || logoUrl) && <img src={logoPreview || logoUrl!} alt="Logo preview" className="w-12 h-12 rounded-xl object-cover mt-1 border border-white/10" />}
                  </div>

                  {error && <div className="sm:col-span-2 text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}
                  <div className="sm:col-span-2 flex justify-end mt-1">
                    <button type="button" onClick={goNext} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">Continue →</button>
                  </div>
                </div>
              )}

              {step === 'bounty' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Bounty Title" value={draft.title} onChange={(v) => set('title', v)} required className="sm:col-span-2" />
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Bounty Description</label>
                    <textarea value={draft.description} onChange={(e) => set('description', e.target.value)} rows={4} className="input resize-y" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Category</label>
                    <select value={draft.category} onChange={(e) => set('category', e.target.value as BountyCategory)} className="input">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <Field label="Required Skills" value={draft.required_skills} onChange={(v) => set('required_skills', v)} placeholder="e.g. React, Solidity" />
                  <Field label="Eligibility Requirements" value={draft.eligibility} onChange={(v) => set('eligibility', v)} className="sm:col-span-2" />
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Expected Deliverables</label>
                    <textarea value={draft.deliverables} onChange={(e) => set('deliverables', e.target.value)} rows={2} className="input resize-y" />
                  </div>

                  {error && <div className="sm:col-span-2 text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}
                  <div className="sm:col-span-2 flex justify-between mt-1">
                    <button type="button" onClick={goBack} className="px-6 py-3 rounded-full font-semibold border border-white/15 hover:bg-white/5 transition-colors">← Back</button>
                    <button type="button" onClick={goNext} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">Continue →</button>
                  </div>
                </div>
              )}

              {step === 'rewards' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Number of Winners" value={draft.num_winners} onChange={(v) => set('num_winners', v)} type="number" required />
                  <Field label="Total Reward" value={draft.total_reward} onChange={(v) => set('total_reward', v)} required placeholder="e.g. 1200" />
                  <Field label="Reward Currency" value={draft.reward_currency} onChange={(v) => set('reward_currency', v)} required placeholder="MON, USDC…" />
                  <Field label="Reward Distribution" value={draft.reward_distribution} onChange={(v) => set('reward_distribution', v)} placeholder="1st: 60%, 2nd: 40%…" />
                  <Field label="Submission Deadline" value={draft.submission_deadline} onChange={(v) => set('submission_deadline', v)} type="date" required />
                  <Field label="Winner Announcement Date" value={draft.winner_announcement_date} onChange={(v) => set('winner_announcement_date', v)} type="date" />
                  <Field label="Payment Method" value={draft.payment_method} onChange={(v) => set('payment_method', v)} placeholder="e.g. On-chain wallet transfer" className="sm:col-span-2" />

                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Proof Reward Funds Are Available</label>
                    <label className="input flex items-center gap-3 cursor-pointer">
                      <UploadCloud size={16} className="text-white/40 shrink-0" />
                      <span className="text-white/50 text-sm truncate">{proofFile ? proofFile.name : proofUrl ? 'Document uploaded' : 'Screenshot, statement, or tx link'}</span>
                      <input type="file" accept="image/*,application/pdf" onChange={onProofChange} className="hidden" />
                    </label>
                    <span className="text-[11px] text-white/30">Private — only visible to the Monad Africa team.</span>
                  </div>

                  {error && <div className="sm:col-span-2 text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}
                  <div className="sm:col-span-2 flex justify-between mt-1">
                    <button type="button" onClick={goBack} className="px-6 py-3 rounded-full font-semibold border border-white/15 hover:bg-white/5 transition-colors">← Back</button>
                    <button type="button" onClick={goNext} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">Continue →</button>
                  </div>
                </div>
              )}

              {step === 'contact' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Contact Person" value={draft.contact_person} onChange={(v) => set('contact_person', v)} required />
                  <Field label="Contact Email" value={draft.contact_email} onChange={(v) => set('contact_email', v)} type="email" required />
                  <Field label="Telegram Contact" value={draft.telegram} onChange={(v) => set('telegram', v)} placeholder="https://t.me/..." className="sm:col-span-2" />
                  <Field label="Relevant Links" value={draft.relevant_links} onChange={(v) => set('relevant_links', v)} className="sm:col-span-2" />
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Terms & Conditions</label>
                    <textarea value={draft.terms} onChange={(e) => set('terms', e.target.value)} rows={3} className="input resize-y" />
                  </div>
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Additional Information</label>
                    <textarea value={draft.additional_info} onChange={(e) => set('additional_info', e.target.value)} rows={2} className="input resize-y" />
                  </div>

                  {error && <div className="sm:col-span-2 text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}
                  <div className="sm:col-span-2 flex justify-between mt-1">
                    <button type="button" onClick={goBack} className="px-6 py-3 rounded-full font-semibold border border-white/15 hover:bg-white/5 transition-colors">← Back</button>
                    <button type="button" onClick={goNext} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">Review →</button>
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-2 text-sm">
                    <ReviewRow label="Project" value={draft.project_name} />
                    <ReviewRow label="Bounty" value={draft.title} />
                    <ReviewRow label="Reward" value={`${draft.total_reward} ${draft.reward_currency} · ${draft.num_winners} winner(s)`} />
                    <ReviewRow label="Deadline" value={draft.submission_deadline} />
                    <ReviewRow label="Contact" value={`${draft.contact_person} · ${draft.contact_email}`} />
                  </div>
                  <p className="text-white/35 text-xs">
                    By submitting, you confirm the reward funds described above are available and that you
                    agree to Monad Africa's review process before this bounty goes public.
                  </p>

                  {error && <div className="text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}
                  <div className="flex justify-between mt-1">
                    <button type="button" onClick={goBack} className="px-6 py-3 rounded-full font-semibold border border-white/15 hover:bg-white/5 transition-colors">← Back</button>
                    <button type="submit" disabled={submitting} className="px-8 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
                      {submitting ? 'Submitting…' : 'Submit for Review →'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {STEPS.map(([key, label], i) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-semibold border ${
            step === key ? 'bg-purple border-purple text-white' : 'border-white/20 text-white/40'
          }`}>{i + 1}</span>
          <span className={`text-xs hidden md:inline ${step === key ? 'text-white' : 'text-white/35'}`}>{label}</span>
          {i < STEPS.length - 1 && <span className="w-4 h-px bg-white/15 mx-0.5" />}
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">{label}</span>
      <p className="text-white/75 mt-0.5 whitespace-pre-line">{value || '—'}</p>
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
