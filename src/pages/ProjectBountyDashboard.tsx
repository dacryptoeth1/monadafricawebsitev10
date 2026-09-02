import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import VerificationBadge from '../components/VerificationBadge'
import { getErrorMessage, logError } from '../lib/errors'
import type {
  Bounty,
  BountyCompletionReport,
  BountyHostingRequest,
  CompletionReportWinner,
  PartnershipApplication,
  Submission,
} from '../types'

type SubmissionRow = Submission & { application: { full_name: string; email: string } | null }

// A project's own limited view onto its approved bounty — RLS-scoped to
// `created_by = auth.uid()` throughout (see migration 0037), so this
// page never needs its own access-control logic: every query here can
// only ever return rows this signed-in user actually owns. Surfaced
// from Dashboard.tsx once a user has an application/request on file.
export default function ProjectBountyDashboard() {
  const { session } = useAuth()
  const uid = session?.user.id

  const [loading, setLoading] = useState(true)
  const [partnerships, setPartnerships] = useState<PartnershipApplication[]>([])
  const [requests, setRequests] = useState<BountyHostingRequest[]>([])
  const [bounty, setBounty] = useState<Bounty | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [report, setReport] = useState<BountyCompletionReport | null>(null)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function load() {
    if (!uid) return
    setLoading(true)
    const [{ data: pData }, { data: rData }] = await Promise.all([
      supabase.from('partnership_applications').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
      supabase.from('bounty_hosting_requests').select('*').eq('created_by', uid).order('created_at', { ascending: false }),
    ])
    setPartnerships((pData as PartnershipApplication[]) ?? [])
    const reqs = (rData as BountyHostingRequest[]) ?? []
    setRequests(reqs)

    const publishedId = reqs.find((r) => r.published_bounty_id)?.published_bounty_id
    if (publishedId) {
      const [{ data: bData }, { data: sData }, { data: repData }] = await Promise.all([
        supabase.from('bounties').select('*').eq('id', publishedId).maybeSingle(),
        supabase.from('submissions').select('*, application:application_id(full_name,email)').eq('bounty_id', publishedId).order('created_at', { ascending: false }),
        supabase.from('bounty_completion_reports').select('*').eq('bounty_id', publishedId).maybeSingle(),
      ])
      setBounty((bData as Bounty) ?? null)
      setSubmissions((sData as unknown as SubmissionRow[]) ?? [])
      setReport((repData as BountyCompletionReport) ?? null)
    } else {
      setBounty(null)
      setSubmissions([])
      setReport(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  async function updateSubmission(s: SubmissionRow, fields: Partial<Pick<Submission, 'shortlisted' | 'proposed_winner' | 'project_feedback'>>) {
    const { error } = await supabase.from('submissions').update(fields).eq('id', s.id)
    if (error) { showToast(getErrorMessage(error, 'Could not save that change.')); return }
    await load()
  }

  const proposedWinners = useMemo(() => submissions.filter((s) => s.proposed_winner), [submissions])

  if (loading) return <div className="pt-36 pb-28 min-h-screen text-center text-white/40 text-sm">Loading…</div>

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal className="mb-10">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Your Applications</span>
          <h1 className="font-display font-semibold text-3xl md:text-4xl mt-3 mb-2">Partnership & bounty dashboard.</h1>
          <p className="text-white/55 max-w-xl">
            Track your Monad Africa applications, and — once your bounty is live — manage submissions from here.
          </p>
        </Reveal>

        {partnerships.length === 0 && requests.length === 0 ? (
          <Reveal className="rounded-squircle border border-white/10 bg-panel/60 p-12 text-center mb-10">
            <p className="text-white/50 mb-4">You haven't submitted a partnership or bounty application yet.</p>
            <div className="flex justify-center gap-3">
              <Link to="/partners#partner-form" className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple">Partner With Us</Link>
              <Link to="/host-bounty" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/5">Host a Bounty</Link>
            </div>
          </Reveal>
        ) : (
          <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {partnerships.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/35 mb-1">Partnership Application</div>
                <div className="font-display font-semibold">{p.project_name}</div>
                <span className="inline-block mt-2 text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-purple/30 text-purple-light">{p.status}</span>
              </div>
            ))}
            {requests.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/35 mb-1">Bounty Hosting Request</div>
                <div className="font-display font-semibold">{r.title || r.project_name || 'Untitled bounty'}</div>
                <span className="inline-block mt-2 text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-purple/30 text-purple-light">{r.status.replace('_', ' ')}</span>
                {r.status === 'changes_requested' && r.admin_notes && (
                  <p className="text-amber-200/70 text-xs mt-2 border-l-2 border-amber-300/30 pl-2">{r.admin_notes}</p>
                )}
                {(r.status === 'draft' || r.status === 'changes_requested') && (
                  <Link to="/host-bounty" className="inline-block mt-3 text-xs font-semibold text-purple-light hover:text-white">Continue application →</Link>
                )}
              </div>
            ))}
          </Reveal>
        )}

        {bounty && (
          <Reveal className="mb-10">
            <div className="rounded-squircle border border-white/10 bg-panel/60 p-6 mb-6">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="font-display font-semibold text-xl">{bounty.title}</h2>
                <VerificationBadge bounty={bounty} size="md" />
              </div>
              <p className="text-white/50 text-sm">{submissions.length} submission{submissions.length === 1 ? '' : 's'} received · reward {bounty.reward}</p>
            </div>

            <h3 className="font-display font-semibold text-lg mb-4">Submissions</h3>
            {submissions.length === 0 ? (
              <div className="text-white/40 text-sm py-6 text-center rounded-2xl border border-white/10 bg-white/[0.02] mb-10">No submissions yet.</div>
            ) : (
              <div className="flex flex-col gap-3 mb-10">
                {submissions.map((s) => (
                  <SubmissionRowCard key={s.id} submission={s} onSave={(fields) => updateSubmission(s, fields)} />
                ))}
              </div>
            )}

            <CompletionReportPanel bounty={bounty} report={report} proposedWinners={proposedWinners} submissionsCount={submissions.length} createdBy={uid!} onSaved={load} showToast={showToast} />
          </Reveal>
        )}

        <Reveal className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-white/50 text-sm">Need help, or want to talk to the team about your application?</p>
          <a href="https://t.me/CryptoTesteer" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/5 transition-colors">
            <Send size={14} /> Contact Monad Africa
          </a>
        </Reveal>

        {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-panel border border-white/15 px-6 py-3 rounded-full text-sm z-50">{toast}</div>}
      </div>
    </section>
  )
}

function SubmissionRowCard({
  submission: s,
  onSave,
}: {
  submission: SubmissionRow
  onSave: (fields: Partial<Pick<Submission, 'shortlisted' | 'proposed_winner' | 'project_feedback'>>) => void
}) {
  const [feedback, setFeedback] = useState(s.project_feedback ?? '')

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-semibold text-sm flex items-center gap-2">
            {s.application?.full_name || 'Applicant'}
            {s.is_winner && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-gold/40 text-gold">🏆 winner</span>}
            {s.proposed_winner && !s.is_winner && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-purple/30 text-purple-light">proposed</span>}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {s.github_repo && <a href={s.github_repo} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">GitHub</a>}
            {s.x_post_link && <a href={s.x_post_link} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">X Post</a>}
            {s.google_docs_link && <a href={s.google_docs_link} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">Docs</a>}
            {s.website_link && <a href={s.website_link} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">Website</a>}
            {s.file_url && <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">File</a>}
          </div>
        </div>
        <div className="flex gap-2 flex-none">
          <button
            onClick={() => onSave({ shortlisted: !s.shortlisted })}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${s.shortlisted ? 'bg-purple/20 border-purple/40 text-purple-light' : 'border-white/15 text-white/50 hover:bg-white/5'}`}
          >
            {s.shortlisted ? 'Shortlisted' : 'Shortlist'}
          </button>
          <button
            onClick={() => onSave({ proposed_winner: !s.proposed_winner })}
            disabled={s.is_winner}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40 ${s.proposed_winner ? 'bg-gold/15 border-gold/30 text-gold' : 'border-white/15 text-white/50 hover:bg-white/5'}`}
          >
            <Star size={12} /> {s.proposed_winner ? 'Proposed' : 'Propose winner'}
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Feedback for this submission (optional)"
          className="input flex-1 text-xs py-2"
        />
        <button onClick={() => onSave({ project_feedback: feedback || null })} className="px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">Save</button>
      </div>
      <p className="text-white/35 text-[11px] mt-2">
        Final winner confirmation is made by the Monad Africa team before the bounty is marked completed.
      </p>
    </div>
  )
}

function CompletionReportPanel({
  bounty,
  report,
  proposedWinners,
  submissionsCount,
  createdBy,
  onSaved,
  showToast,
}: {
  bounty: Bounty
  report: BountyCompletionReport | null
  proposedWinners: SubmissionRow[]
  submissionsCount: number
  createdBy: string
  onSaved: () => void
  showToast: (msg: string) => void
}) {
  const [summary, setSummary] = useState(report?.summary ?? '')
  const [links, setLinks] = useState(report?.winning_submission_links ?? '')
  const [participantFeedback, setParticipantFeedback] = useState(report?.participant_feedback ?? '')
  const [unresolved, setUnresolved] = useState(report?.unresolved_issues ?? '')
  const [winners, setWinners] = useState<CompletionReportWinner[]>(
    report?.winners?.length
      ? report.winners
      : proposedWinners.map((s) => ({ submission_id: s.id, wallet_or_payment_details: '', reward_amount: '', tx_hash: '' })),
  )
  const [saving, setSaving] = useState(false)

  // Newly proposed winners (from the submission list above, which can
  // change after this panel has already mounted) need a payment-detail
  // row added without wiping whatever's already been typed for existing
  // ones — the useState initializer above only ever runs once. Once a
  // saved report exists, its own `winners` array is authoritative and
  // this intentionally stops syncing from proposedWinners.
  useEffect(() => {
    if (report) return
    setWinners((prev) => {
      const existingIds = new Set(prev.map((w) => w.submission_id))
      const additions = proposedWinners
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({ submission_id: s.id, wallet_or_payment_details: '', reward_amount: '', tx_hash: '' }))
      return additions.length ? [...prev, ...additions] : prev
    })
  }, [proposedWinners, report])

  const locked = report?.status === 'submitted' || report?.status === 'approved'

  function setWinner(i: number, field: keyof CompletionReportWinner, value: string) {
    setWinners((w) => w.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))
  }

  async function save(nextStatus: 'draft' | 'submitted') {
    setSaving(true)
    const payload = {
      bounty_id: bounty.id,
      submissions_count: submissionsCount,
      summary: summary || null,
      winning_submission_links: links || null,
      participant_feedback: participantFeedback || null,
      unresolved_issues: unresolved || null,
      winners,
      status: nextStatus,
    }
    const { error } = report
      ? await supabase.from('bounty_completion_reports').update(payload).eq('id', report.id)
      : await supabase.from('bounty_completion_reports').insert({ ...payload, created_by: createdBy })
    setSaving(false)
    if (error) { showToast(getErrorMessage(error, 'Could not save the completion report.')); logError('[ProjectBountyDashboard] save report failed:', error); return }
    showToast(nextStatus === 'submitted' ? 'Completion report submitted for review' : 'Draft saved')
    onSaved()
  }

  return (
    <div>
      <h3 className="font-display font-semibold text-lg mb-1">Completion report</h3>
      <p className="text-white/40 text-xs mb-4">
        {locked
          ? report?.status === 'approved'
            ? 'Approved — now visible on the public bounty card.'
            : 'Submitted — awaiting Monad Africa review.'
          : 'Fill this in once the bounty has ended. Wallet/payment details stay private; a summary is shown publicly once approved.'}
      </p>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-4">
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} disabled={locked} rows={3} placeholder="Summary of the completed work" className="input resize-y disabled:opacity-50" />

        {winners.length > 0 && (
          <div className="flex flex-col gap-3">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Winner Payment Details</label>
            {winners.map((w, i) => (
              <div key={w.submission_id} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={w.wallet_or_payment_details} onChange={(e) => setWinner(i, 'wallet_or_payment_details', e.target.value)} disabled={locked} placeholder="Wallet / payment details" className="input text-xs py-2 disabled:opacity-50" />
                <input value={w.reward_amount} onChange={(e) => setWinner(i, 'reward_amount', e.target.value)} disabled={locked} placeholder="Reward paid" className="input text-xs py-2 disabled:opacity-50" />
                <input value={w.tx_hash} onChange={(e) => setWinner(i, 'tx_hash', e.target.value)} disabled={locked} placeholder="Tx hash / payment proof" className="input text-xs py-2 disabled:opacity-50" />
              </div>
            ))}
          </div>
        )}

        <input value={links} onChange={(e) => setLinks(e.target.value)} disabled={locked} placeholder="Links to winning submissions" className="input disabled:opacity-50" />
        <textarea value={participantFeedback} onChange={(e) => setParticipantFeedback(e.target.value)} disabled={locked} rows={2} placeholder="Participant feedback (optional)" className="input resize-y disabled:opacity-50" />
        <textarea value={unresolved} onChange={(e) => setUnresolved(e.target.value)} disabled={locked} rows={2} placeholder="Any unresolved issues (optional)" className="input resize-y disabled:opacity-50" />

        {!locked && (
          <div className="flex justify-end gap-3">
            <button onClick={() => save('draft')} disabled={saving} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-50">Save draft</button>
            <button onClick={() => save('submitted')} disabled={saving} className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">Submit report</button>
          </div>
        )}
      </div>
    </div>
  )
}
