import { useState, type FormEvent } from 'react'
import { Flag, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Report } from '../types'

export default function ReportButton({
  targetType,
  targetId,
  className = '',
}: {
  targetType: Report['target_type']
  targetId: string
  className?: string
}) {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleClick() {
    if (!session) {
      navigate('/login')
      return
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={`Report this ${targetType}`}
        className={`inline-flex items-center gap-1 text-white/25 hover:text-rose-300 transition-colors ${className}`}
      >
        <Flag size={12} />
      </button>
      {open && profile && (
        <ReportModal targetType={targetType} targetId={targetId} reporterId={profile.id} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function ReportModal({
  targetType,
  targetId,
  reporterId,
  onClose,
}: {
  targetType: Report['target_type']
  targetId: string
  reporterId: string
  onClose: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const reason = String(new FormData(e.currentTarget).get('reason') || '').trim()
    if (!reason) {
      setError('Please describe the issue.')
      return
    }
    setSubmitting(true)
    try {
      const { error: err } = await supabase.from('reports').insert({
        reporter_id: reporterId,
        target_type: targetType,
        target_id: targetId,
        reason,
      })
      if (err) throw err
      setDone(true)
    } catch {
      setError('Something went wrong submitting your report — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-squircle border border-white/10 bg-panel p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X size={16} />
        </button>

        {done ? (
          <div className="text-center py-4">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-lg">✓</div>
            <h3 className="font-display font-semibold text-base mb-1">Report submitted.</h3>
            <p className="text-white/50 text-xs">The team will review it shortly.</p>
          </div>
        ) : (
          <>
            <h3 className="font-display font-semibold text-base mb-1 flex items-center gap-2">
              <Flag size={14} className="text-rose-300" /> Report this {targetType}
            </h3>
            <p className="text-white/40 text-xs mb-4">Tell us what's wrong — spam, a scam, abuse, or anything else.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <textarea name="reason" rows={3} placeholder="What's the issue?" className="input resize-y text-sm" />
              {error && <div className="text-xs text-rose-300">{error}</div>}
              <button type="submit" disabled={submitting} className="px-4 py-2.5 rounded-full text-sm font-semibold bg-rose-500/20 border border-rose-400/40 text-rose-300 hover:bg-rose-500/30 disabled:opacity-50">
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
