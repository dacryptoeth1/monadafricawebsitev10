import { memo, useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ReportButton from './ReportButton'
import VerificationBadge from './VerificationBadge'
import type { Bounty, BountyCompletionReportPublic } from '../types'
import { getErrorMessage, logError } from '../lib/errors'

const difficultyStyles: Record<Bounty['difficulty'], string> = {
  easy: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  medium: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
  hard: 'text-rose-300 border-rose-300/30 bg-rose-300/10',
}

// Wrapped in memo: the Bounties page re-renders on every keystroke in
// its search box (filtering a potentially multi-dozen-card grid), and
// without this every BountyCard in the grid — including ones whose own
// `bounty` prop didn't change — re-ran its full render + framer-motion
// tree on every character typed. `bounty` is a stable object reference
// across re-renders (Array.filter() doesn't clone items), so memo's
// default shallow-prop comparison correctly skips unaffected cards.
//
// `variant`: 'card' (default) is the original tall grid tile. 'row' is
// a compact single-line list layout (Superteam Earn-style opportunity
// list) used on the homepage and the /bounties browse page — same
// state/handlers/modal below, only the outer presentation differs, so
// the apply flow and credit logic can't drift between the two.
export default memo(function BountyCard({ bounty, variant = 'card' }: { bounty: Bounty; variant?: 'card' | 'row' }) {
  const [open, setOpen] = useState(false)
  const { session } = useAuth()
  const navigate = useNavigate()

  // completion_status !== 'none' (cancelled/under_review/completed/expired)
  // blocks new applications independent of is_closed — an admin cancelling
  // a still-open bounty (AdminDashboard.tsx's setCompletionStatus) doesn't
  // separately flip is_closed, so this can't rely on that alone.
  const unavailable = bounty.is_closed || bounty.is_deleted || bounty.status !== 'approved' || bounty.completion_status !== 'none'

  function handleApplyClick() {
    if (unavailable) return // belt-and-suspenders — button is already disabled below
    if (!session) {
      navigate('/login', { state: { from: '/opportunities' } })
      return
    }
    setOpen(true)
  }

  const logo = (
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0">
      {bounty.logo_url ? (
        <img src={bounty.logo_url} alt={bounty.project_name} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span className="font-display font-bold text-sm">{bounty.project_name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )

  if (variant === 'row') {
    return (
      <>
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-2xl border border-white/10 bg-panel/70 hover:border-purple/40 transition-colors p-4 sm:p-5"
        >
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4">
            {logo}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-semibold text-base leading-tight truncate">{bounty.title}</h3>
                <VerificationBadge bounty={bounty} />
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-white/40 mt-1">
                <span className="truncate max-w-[10rem]">{bounty.project_name}</span>
                <span className="text-white/20">·</span>
                <span className="font-mono uppercase text-[10px] text-white/45">{bounty.category}</span>
              </div>
            </div>
            <div className="flex items-center gap-5 ml-auto sm:ml-0 shrink-0">
              <div className="text-right">
                <div className="font-mono font-semibold text-gold text-sm">{bounty.reward}</div>
                <div className="text-[10px] text-white/35 font-mono mt-0.5">Due {formatDate(bounty.deadline)}</div>
              </div>
              {unavailable ? (
                <span className="text-xs font-semibold text-white/30 cursor-not-allowed whitespace-nowrap" title="This bounty is no longer accepting applications">
                  Closed
                </span>
              ) : (
                <button
                  onClick={handleApplyClick}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform whitespace-nowrap"
                >
                  Apply →
                </button>
              )}
              <ReportButton targetType="bounty" targetId={bounty.id} className="shrink-0" />
            </div>
          </div>

          {bounty.completion_status === 'completed' && <CompletionReportSection bountyId={bounty.id} />}
        </motion.div>

        <AnimatePresence>{open && !unavailable && <ApplyModal bounty={bounty} onClose={() => setOpen(false)} />}</AnimatePresence>
      </>
    )
  }

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        // No backdrop-blur here (unlike this file's modal overlay below):
        // this card repeats N times in the /bounties grid and the
        // homepage preview, and unlike a one-off modal backdrop, a
        // blur-behind-content on every card in a scrolling list forces
        // the browser to recompute that blur continuously as the page
        // scrolls — a real, well-documented mobile GPU cost. Bumped the
        // panel opacity instead (60% -> 85%) so the card still reads as
        // solid rather than see-through without the blur.
        className="rounded-squircle border border-white/10 bg-panel/85 p-6 flex flex-col gap-4 hover:border-purple/40 transition-colors h-full"
      >
        <div className="flex items-center gap-3">
          {logo}
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-base leading-tight truncate">{bounty.title}</h3>
            <span className="text-xs text-white/40">{bounty.project_name}</span>
          </div>
          <ReportButton targetType="bounty" targetId={bounty.id} className="ml-auto shrink-0 mt-1" />
        </div>

        <p className="text-sm text-white/60 leading-relaxed line-clamp-3">{bounty.description}</p>

        <div className="flex flex-wrap gap-2">
          <VerificationBadge bounty={bounty} />
          <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${difficultyStyles[bounty.difficulty]}`}>{bounty.difficulty}</span>
          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{bounty.category}</span>
        </div>

        {bounty.skills_needed && (
          <div className="text-xs text-white/40"><span className="text-white/30">Skills: </span>{bounty.skills_needed}</div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-auto">
          <div>
            <div className="font-mono font-semibold text-gold">{bounty.reward}</div>
            <div className="text-[10px] text-white/35 font-mono mt-0.5">Deadline · {formatDate(bounty.deadline)}</div>
          </div>
          {unavailable ? (
            <span className="text-sm font-semibold text-white/30 cursor-not-allowed" title="This bounty is no longer accepting applications">
              Applications closed
            </span>
          ) : (
            <button onClick={handleApplyClick} className="text-sm font-semibold text-purple-light hover:text-white transition-colors">
              Apply →
            </button>
          )}
        </div>

        {bounty.completion_status === 'completed' && <CompletionReportSection bountyId={bounty.id} />}
      </motion.div>

      <AnimatePresence>{open && !unavailable && <ApplyModal bounty={bounty} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
})

// Shown on a completed bounty's card only — pulls from
// bounty_completion_reports_public (migration 0037), which excludes
// wallet addresses, payment details, and tx hashes by construction, so
// there's nothing private for this component to accidentally leak.
function CompletionReportSection({ bountyId }: { bountyId: string }) {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<BountyCompletionReportPublic | null | undefined>(undefined)

  useEffect(() => {
    if (!open || report !== undefined) return
    supabase
      .from('bounty_completion_reports_public')
      .select('*')
      .eq('bounty_id', bountyId)
      .maybeSingle()
      .then(({ data }) => setReport((data as BountyCompletionReportPublic) ?? null))
  }, [open, report, bountyId])

  return (
    <div className="pt-3 border-t border-white/10 -mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold/80 transition-colors"
      >
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        View completion report
      </button>
      {open && (
        report === undefined ? (
          <div className="text-white/30 text-xs mt-2">Loading…</div>
        ) : report === null ? (
          <div className="text-white/30 text-xs mt-2">No public report available yet.</div>
        ) : (
          <div className="mt-3 flex flex-col gap-2 text-xs text-white/55 leading-relaxed">
            {report.summary && <p>{report.summary}</p>}
            <div className="text-white/35 font-mono">{report.submissions_count ?? 0} submission{report.submissions_count === 1 ? '' : 's'} received</div>
            {report.winning_submission_links && (
              <div>
                <span className="text-white/35">Winning submissions: </span>
                <span className="break-words">{report.winning_submission_links}</span>
              </div>
            )}
            {report.unresolved_issues && (
              <div className="text-amber-200/70 border-l-2 border-amber-300/25 pl-2">{report.unresolved_issues}</div>
            )}
          </div>
        )
      )}
    </div>
  )
}

function ApplyModal({ bounty, onClose }: { bounty: Bounty; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const noCredits = (profile?.credits ?? 0) <= 0

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    const form = e.currentTarget
    const data = new FormData(form)
    setSubmitting(true)
    try {
      // Applying costs 1 credit. This goes through the apply_to_bounty()
      // Postgres function (not a direct table insert) so the credit
      // check-and-deduct happens atomically server-side — it can't be
      // bypassed or raced by calling the API directly.
      const { error: err } = await supabase.rpc('apply_to_bounty', {
        p_bounty_id: bounty.id,
        p_portfolio_link: String(data.get('portfolio_link') || ''),
        p_message: String(data.get('message') || ''),
      })
      if (err) throw err
      await refreshProfile()
      setDone(true)
    } catch (err) {
      logError('[BountyCard] apply_to_bounty failed:', err)
      setError(getErrorMessage(err, 'Something went wrong submitting your application — please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-squircle border border-white/10 bg-panel p-7 relative"
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white">
          <X size={18} />
        </button>

        {done ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-xl">✓</div>
            <h3 className="font-display font-semibold text-lg mb-2">Application sent.</h3>
            <p className="text-white/55 text-sm">
              The Monad Africa team will review it — track its status from your{' '}
              <a href="/dashboard" className="text-purple-light">dashboard</a>.
            </p>
          </div>
        ) : noCredits ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-300/10 border border-amber-300/30 flex items-center justify-center text-xl">⚠</div>
            <h3 className="font-display font-semibold text-lg mb-2">No credits remaining</h3>
            <p className="text-white/55 text-sm">
              You need at least 1 credit to apply. Refer a friend from your{' '}
              <a href="/dashboard" className="text-purple-light">dashboard</a> to earn more.
            </p>
          </div>
        ) : (
          <>
            <h3 className="font-display font-semibold text-lg mb-1">Apply to {bounty.title}</h3>
            <p className="text-white/40 text-xs mb-5">
              {bounty.project_name} · applying as {profile?.full_name || profile?.username} · costs 1 credit ({profile?.credits} remaining)
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input name="portfolio_link" type="url" placeholder="Portfolio / GitHub link" className="input" />
              <textarea name="message" rows={3} placeholder="Why you're a fit (optional)" className="input resize-y" />
              {error && <div className="text-xs text-rose-300">{error}</div>}
              <button type="submit" disabled={submitting} className="mt-1 px-5 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
                {submitting ? 'Sending…' : 'Send Application'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
