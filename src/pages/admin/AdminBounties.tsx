import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import type { Bounty, BountyCategory, BountyCompletionReport, BountyDifficulty, BountyLifecycleStatus, VerificationBadgeType } from '../../types'
import { bountyLifecycleStatus } from '../../types'

export type BountyDraft = {
  project_name: string
  logo_url: string
  website: string
  twitter: string
  discord: string
  contact_email: string
  title: string
  description: string
  skills_needed: string
  category: BountyCategory
  difficulty: BountyDifficulty
  reward: string
  deadline: string
  verification_badge: VerificationBadgeType
}

const CATEGORIES: BountyCategory[] = ['Development', 'Design', 'Marketing', 'Community', 'Content']
const DIFFICULTIES: BountyDifficulty[] = ['easy', 'medium', 'hard']
const BADGES: VerificationBadgeType[] = ['verified', 'partner', 'community']

const FILTERS: [BountyLifecycleStatus | 'all', string][] = [
  ['all', 'All'],
  ['active', 'Active'],
  ['closed', 'Closed'],
  ['draft', 'Draft'],
  ['deleted', 'Deleted'],
]

const STATUS_BADGE: Record<BountyLifecycleStatus, string> = {
  active: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  closed: 'text-white/60 border-white/25 bg-white/5',
  draft: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
  deleted: 'text-rose-300 border-rose-300/30 bg-rose-300/10',
}

// The "Manage Bounties" tab of the Admin Dashboard — the single place
// every bounty (draft/active/closed/deleted) is administered from,
// replacing the previous three separate Pending/Approved/Rejected tabs.
// A bounty's lifecycle status is derived (bountyLifecycleStatus), not a
// stored column — see migration 0031 and the comment on that function
// in types.ts for why.
export default function AdminBounties({
  bounties,
  loadError,
  submissionCounts,
  applicationCounts,
  completionReports,
  showToast,
  onCreate,
  onUpdate,
  onApprove,
  onReject,
  onRestoreToDraft,
  onClose,
  onReopen,
  onSoftDelete,
  onRestoreDeleted,
  onToggleFeatured,
  onSetCompletionStatus,
  onApproveCompletionReport,
}: {
  bounties: Bounty[]
  loadError?: string | null
  submissionCounts: Record<string, number>
  applicationCounts: Record<string, number>
  completionReports: Record<string, BountyCompletionReport>
  showToast: (msg: string) => void
  onCreate: (draft: BountyDraft) => Promise<boolean>
  onUpdate: (id: string, draft: BountyDraft) => Promise<boolean>
  onApprove: (b: Bounty) => void
  onReject: (b: Bounty) => void
  onRestoreToDraft: (b: Bounty) => void
  onClose: (b: Bounty) => void
  onReopen: (b: Bounty) => void
  onSoftDelete: (b: Bounty) => void
  onRestoreDeleted: (b: Bounty) => void
  onToggleFeatured: (b: Bounty) => void
  onSetCompletionStatus: (b: Bounty, status: Bounty['completion_status']) => void
  onApproveCompletionReport: (b: Bounty) => void
}) {
  const [filter, setFilter] = useState<BountyLifecycleStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Bounty | 'new' | null>(null)
  // Selection only — no bulk action exists on this panel yet (every
  // action button below still acts on one bounty at a time), so this
  // is purely the "select individually / select multiple / select all"
  // mechanism the admin dashboard needs, not a new destructive feature.
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Switching status tabs (or search) must not leave a stale selection
  // referring to bounties that are no longer even visible.
  useEffect(() => {
    setSelected(new Set())
  }, [filter])

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const counts = useMemo(() => {
    const c: Record<BountyLifecycleStatus, number> = { active: 0, closed: 0, draft: 0, deleted: 0 }
    bounties.forEach((b) => c[bountyLifecycleStatus(b)]++)
    return c
  }, [bounties])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bounties
      .filter((b) => filter === 'all' || bountyLifecycleStatus(b) === filter)
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.project_name.toLowerCase().includes(q))
  }, [bounties, filter, search])

  if (loadError) return <div className="text-rose-300 text-sm py-10 text-center">Couldn't load bounties: {loadError}</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by bounty or project name…"
            className="input w-full pl-9 text-sm"
          />
        </div>
        <button
          onClick={() => setEditing('new')}
          className="sm:ml-auto px-4 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform"
        >
          + New Bounty
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filter === key ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55 hover:bg-white/5'
            }`}
          >
            {label}
            {key !== 'all' && ` (${counts[key]})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">
          {bounties.length === 0 ? 'No bounties yet — create one to get started.' : 'No bounties match this filter/search.'}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 text-xs text-white/50">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filtered.every((b) => selected.has(b.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((b) => b.id)) : new Set())}
                aria-label="Select all visible bounties"
              />
              Select all visible ({filtered.length})
            </label>
            {selected.size > 0 && (
              <span className="flex items-center gap-2">
                <span className="text-purple-light font-semibold">{selected.size} selected</span>
                <button onClick={() => setSelected(new Set())} className="text-white/40 hover:text-white underline underline-offset-2">Clear</button>
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
          {filtered.map((b) => (
            <BountyRow
              key={b.id}
              bounty={b}
              submissionCount={submissionCounts[b.id] ?? 0}
              applicationCount={applicationCounts[b.id] ?? 0}
              completionReport={completionReports[b.id]}
              selected={selected.has(b.id)}
              onToggleSelect={() => toggleSelect(b.id)}
              onEdit={() => setEditing(b)}
              onApprove={() => onApprove(b)}
              onReject={() => onReject(b)}
              onRestoreToDraft={() => onRestoreToDraft(b)}
              onClose={() => onClose(b)}
              onReopen={() => onReopen(b)}
              onSoftDelete={() => onSoftDelete(b)}
              onRestoreDeleted={() => onRestoreDeleted(b)}
              onToggleFeatured={() => onToggleFeatured(b)}
              onSetCompletionStatus={(status) => onSetCompletionStatus(b, status)}
              onApproveCompletionReport={() => onApproveCompletionReport(b)}
            />
          ))}
          </div>
        </>
      )}

      {editing && (
        <BountyEditorModal
          bounty={editing === 'new' ? null : editing}
          showToast={showToast}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            const ok = editing === 'new' ? await onCreate(draft) : await onUpdate(editing.id, draft)
            if (ok) setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function BountyRow({
  bounty: b,
  submissionCount,
  applicationCount,
  completionReport,
  selected,
  onToggleSelect,
  onEdit,
  onApprove,
  onReject,
  onRestoreToDraft,
  onClose,
  onReopen,
  onSoftDelete,
  onRestoreDeleted,
  onToggleFeatured,
  onSetCompletionStatus,
  onApproveCompletionReport,
}: {
  bounty: Bounty
  submissionCount: number
  applicationCount: number
  completionReport?: BountyCompletionReport
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onApprove: () => void
  onReject: () => void
  onRestoreToDraft: () => void
  onClose: () => void
  onReopen: () => void
  onSoftDelete: () => void
  onRestoreDeleted: () => void
  onToggleFeatured: () => void
  onSetCompletionStatus: (status: Bounty['completion_status']) => void
  onApproveCompletionReport: () => void
}) {
  const lifecycle = bountyLifecycleStatus(b)
  const btn = 'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap'
  const [showReport, setShowReport] = useState(false)

  return (
    <div className={`rounded-2xl border p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-4 transition-colors ${
      selected ? 'border-purple bg-purple/[0.06] ring-1 ring-purple/40' : 'border-white/10 bg-white/[0.02]'
    }`}>
      <div className="min-w-0 flex-1 flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${b.title}`}
          className="mt-1.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h3 className="font-display font-semibold truncate">{b.title}</h3>
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${STATUS_BADGE[lifecycle]}`}>{lifecycle}</span>
          {b.status === 'rejected' && !b.is_deleted && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-rose-300/25 text-rose-300/70">rejected</span>}
          {b.is_featured && !b.is_deleted && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-gold/40 text-gold">featured</span>}
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/15 text-white/45">{b.verification_badge}</span>
          {b.completion_status !== 'none' && (
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-purple/30 text-purple-light">{b.completion_status.replace('_', ' ')}</span>
          )}
        </div>
        <div className="text-white/50 text-xs mb-2">{b.project_name} · {b.reward} · {b.category} · {b.difficulty}</div>
        <p className="text-white/40 text-xs leading-relaxed line-clamp-2 max-w-2xl mb-2">{b.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/35 font-mono">
          <span>Deadline · {b.deadline || '—'}</span>
          <span>Created · {formatDate(b.created_at)}</span>
          <span>{applicationCount} application{applicationCount === 1 ? '' : 's'}</span>
          <span>{submissionCount} submission{submissionCount === 1 ? '' : 's'}</span>
        </div>

        {completionReport && completionReport.status !== 'draft' && (
          <div className="mt-3">
            <button onClick={() => setShowReport((s) => !s)} className="text-xs font-semibold text-gold hover:text-gold/80">
              {showReport ? 'Hide' : 'Review'} completion report ({completionReport.status})
            </button>
            {showReport && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-2 text-xs text-white/55 max-w-2xl">
                {completionReport.summary && <p>{completionReport.summary}</p>}
                <div className="text-white/35 font-mono">{completionReport.submissions_count ?? 0} submissions · {completionReport.winners.length} winner(s) recorded</div>
                {completionReport.status === 'submitted' && (
                  <button onClick={onApproveCompletionReport} className={`${btn} self-start bg-emerald-400/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-400/25`}>
                    Approve report & mark completed
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end lg:max-w-[300px]">
        {lifecycle === 'draft' && (
          <>
            <button onClick={onApprove} className={`${btn} bg-emerald-400/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-400/25`}>Activate</button>
            {b.status !== 'rejected' && <button onClick={onReject} className={`${btn} bg-rose-400/15 text-rose-300 border-rose-400/30 hover:bg-rose-400/25`}>Reject</button>}
            {b.status === 'rejected' && <button onClick={onRestoreToDraft} className={`${btn} border-white/15 text-white/60 hover:bg-white/5`}>Back to draft</button>}
          </>
        )}
        {lifecycle === 'active' && (
          <>
            <button onClick={onClose} className={`${btn} border-white/15 text-white/60 hover:bg-white/5`}>Close Bounty</button>
            <button onClick={onToggleFeatured} className={`${btn} border-gold/30 text-gold hover:bg-gold/10`}>{b.is_featured ? 'Unfeature' : 'Feature'}</button>
          </>
        )}
        {lifecycle === 'closed' && (
          <>
            <button onClick={onReopen} className={`${btn} bg-emerald-400/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-400/25`}>Reopen Bounty</button>
            {b.completion_status === 'none' && <button onClick={() => onSetCompletionStatus('under_review')} className={`${btn} border-purple/30 text-purple-light hover:bg-purple/10`}>Mark Under Review</button>}
          </>
        )}
        {b.completion_status === 'none' && lifecycle !== 'deleted' && lifecycle !== 'draft' && (
          <button onClick={() => onSetCompletionStatus('cancelled')} className={`${btn} border-white/15 text-white/40 hover:bg-white/5`}>Cancel</button>
        )}
        {b.completion_status === 'under_review' && (
          <button onClick={() => onSetCompletionStatus('expired')} className={`${btn} border-rose-300/25 text-rose-300/70 hover:bg-rose-300/10`}>Mark Expired</button>
        )}
        {lifecycle !== 'deleted' && (
          <>
            <button onClick={onEdit} className={`${btn} border-purple-light/40 text-purple-light hover:bg-purple-light/10`}>Edit</button>
            <button onClick={onSoftDelete} className={`${btn} border-white/15 text-white/40 hover:bg-white/5`}>Delete</button>
          </>
        )}
        {lifecycle === 'deleted' && (
          <button onClick={onRestoreDeleted} className={`${btn} border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10`}>Restore</button>
        )}
      </div>
    </div>
  )
}

function emptyDraft(): BountyDraft {
  return {
    project_name: '', logo_url: '', website: '', twitter: '', discord: '', contact_email: '',
    title: '', description: '', skills_needed: '', category: 'Development', difficulty: 'medium',
    reward: '', deadline: '', verification_badge: 'community',
  }
}

function BountyEditorModal({
  bounty,
  showToast,
  onClose,
  onSave,
}: {
  bounty: Bounty | null
  showToast: (msg: string) => void
  onClose: () => void
  onSave: (draft: BountyDraft) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<BountyDraft>(
    bounty
      ? {
          project_name: bounty.project_name, logo_url: bounty.logo_url ?? '', website: bounty.website ?? '',
          twitter: bounty.twitter ?? '', discord: bounty.discord ?? '', contact_email: bounty.contact_email,
          title: bounty.title, description: bounty.description, skills_needed: bounty.skills_needed ?? '',
          category: bounty.category, difficulty: bounty.difficulty, reward: bounty.reward, deadline: bounty.deadline,
          verification_badge: bounty.verification_badge,
        }
      : emptyDraft(),
  )

  function set<K extends keyof BountyDraft>(key: K, value: BountyDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.project_name.trim() || !draft.contact_email.trim() || !draft.title.trim() || !draft.description.trim() || !draft.reward.trim() || !draft.deadline) {
      showToast('Please fill in all required fields.')
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-squircle border border-white/10 bg-panel p-6"
      >
        <h3 className="font-display font-semibold text-lg mb-4">{bounty ? `Edit "${bounty.title}"` : 'New bounty'}</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EField label="Project Name" value={draft.project_name} onChange={(v) => set('project_name', v)} required />
          <EField label="Contact Email" value={draft.contact_email} onChange={(v) => set('contact_email', v)} type="email" required />
          <EField label="Website" value={draft.website} onChange={(v) => set('website', v)} type="url" />
          <EField label="X (Twitter)" value={draft.twitter} onChange={(v) => set('twitter', v)} />
          <EField label="Discord" value={draft.discord} onChange={(v) => set('discord', v)} />
          <EField label="Logo URL" value={draft.logo_url} onChange={(v) => set('logo_url', v)} type="url" />
          <EField label="Bounty Title" value={draft.title} onChange={(v) => set('title', v)} required className="sm:col-span-2" />

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Category</label>
            <select value={draft.category} onChange={(e) => set('category', e.target.value as BountyCategory)} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Difficulty</label>
            <select value={draft.difficulty} onChange={(e) => set('difficulty', e.target.value as BountyDifficulty)} className="input">
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Verification Badge</label>
            <select value={draft.verification_badge} onChange={(e) => set('verification_badge', e.target.value as VerificationBadgeType)} className="input">
              {BADGES.map((b) => <option key={b} value={b}>{b[0].toUpperCase() + b.slice(1)}</option>)}
            </select>
          </div>

          <EField label="Skills Needed" value={draft.skills_needed} onChange={(v) => set('skills_needed', v)} className="sm:col-span-2" />
          <EField label="Reward" value={draft.reward} onChange={(v) => set('reward', v)} required placeholder="e.g. $1,200" />
          <EField label="Deadline" value={draft.deadline} onChange={(v) => set('deadline', v)} type="date" required />

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Description</label>
            <textarea value={draft.description} onChange={(e) => set('description', e.target.value)} required rows={4} className="input resize-y" />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
              {saving ? 'Saving…' : bounty ? 'Save changes' : 'Create bounty (as draft)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EField({
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

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
