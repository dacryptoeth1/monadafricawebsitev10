import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ReportButton from './ReportButton'
import type { Bounty } from '../types'

const difficultyStyles: Record<Bounty['difficulty'], string> = {
  easy: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  medium: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
  hard: 'text-rose-300 border-rose-300/30 bg-rose-300/10',
}

export default function BountyCard({ bounty }: { bounty: Bounty }) {
  const [open, setOpen] = useState(false)
  const { session } = useAuth()
  const navigate = useNavigate()

  function handleApplyClick() {
    if (!session) {
      navigate('/login', { state: { from: '/bounties' } })
      return
    }
    setOpen(true)
  }

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        className="rounded-squircle border border-white/10 bg-panel/60 backdrop-blur p-6 flex flex-col gap-4 hover:border-purple/40 transition-colors h-full"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0">
            {bounty.logo_url ? (
              <img src={bounty.logo_url} alt={bounty.project_name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display font-bold text-sm">{bounty.project_name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-base leading-tight truncate">{bounty.title}</h3>
            <span className="text-xs text-white/40">{bounty.project_name}</span>
          </div>
          <ReportButton targetType="bounty" targetId={bounty.id} className="ml-auto shrink-0 mt-1" />
        </div>

        <p className="text-sm text-white/60 leading-relaxed line-clamp-3">{bounty.description}</p>

        <div className="flex flex-wrap gap-2">
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
          <button onClick={handleApplyClick} className="text-sm font-semibold text-purple-light hover:text-white transition-colors">
            Apply →
          </button>
        </div>
      </motion.div>

      <AnimatePresence>{open && <ApplyModal bounty={bounty} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
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
    } catch (err: any) {
      setError(err?.message || 'Something went wrong submitting your application — please try again.')
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
