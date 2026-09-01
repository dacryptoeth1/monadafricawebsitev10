import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import { getErrorMessage, logError } from '../../lib/errors'
import { BOUNTY_HOSTING_REQUEST_STATUSES, type BountyCategory, type BountyHostingRequest, type BountyHostingRequestStatus, type Profile } from '../../types'

const STATUS_STYLES: Record<BountyHostingRequestStatus, string> = {
  draft: 'text-white/50 border-white/20',
  pending_review: 'text-amber-300 border-amber-300/30',
  changes_requested: 'text-sunset-amber border-sunset-amber/40',
  approved: 'text-emerald-300 border-emerald-300/30',
  rejected: 'text-rose-300 border-rose-300/30',
}

const CATEGORIES: BountyCategory[] = ['Development', 'Design', 'Marketing', 'Community', 'Content']

// Manages public.bounty_hosting_requests (migration 0037) — the
// admin-review side of "Host a Bounty" applications, before they ever
// become a public bounty. Publishing (via publish_bounty_hosting_request)
// is what actually creates the row in public.bounties that AdminBounties.tsx
// and the public /bounties page work with.
export default function AdminBountyRequests({ showToast }: { showToast: (msg: string) => void }) {
  const [items, setItems] = useState<BountyHostingRequest[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | BountyHostingRequestStatus>('pending_review')
  const [categoryFilter, setCategoryFilter] = useState<'all' | BountyCategory>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [editing, setEditing] = useState<BountyHostingRequest | null>(null)

  async function load() {
    setLoading(true)
    const [{ data, error }, { data: admins }] = await Promise.all([
      supabase.from('bounty_hosting_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('admins').select('id'),
    ])
    if (error) { console.error('Failed to load bounty hosting requests:', error); showToast(error.message); setLoadError(error.message); setLoading(false); return }
    setLoadError(null)
    setItems((data as BountyHostingRequest[]) ?? [])
    const ids = (admins ?? []).map((a: any) => a.id)
    if (ids.length) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids)
      setStaff((profiles as Profile[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => categoryFilter === 'all' || r.category === categoryFilter)
      .filter((r) => !q || (r.project_name || '').toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q))
  }, [items, statusFilter, categoryFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    items.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1 })
    return c
  }, [items])

  async function setStatus(r: BountyHostingRequest, status: BountyHostingRequestStatus, note?: string) {
    const ok = await runAdminAction(
      () => supabase.from('bounty_hosting_requests').update({ status, admin_notes: note ?? r.admin_notes }).eq('id', r.id),
      showToast,
      { successMessage: status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Changes requested' },
    )
    if (ok) { setExpandedId(null); await load() }
  }

  async function assignAdmin(r: BountyHostingRequest, adminId: string) {
    const ok = await runAdminAction(
      () => supabase.from('bounty_hosting_requests').update({ assigned_admin: adminId || null }).eq('id', r.id),
      showToast,
      { successMessage: 'Assigned' },
    )
    if (ok) await load()
  }

  async function publish(r: BountyHostingRequest) {
    if (!confirm(`Publish "${r.title}" to the public bounty board?`)) return
    const { error } = await supabase.rpc('publish_bounty_hosting_request', { p_request_id: r.id })
    if (error) { logError('[AdminBountyRequests] publish failed:', error); showToast(getErrorMessage(error, 'Could not publish this bounty.')); return }
    showToast('Bounty published — now live on the public board')
    await load()
  }

  function openNotes(r: BountyHostingRequest) {
    setExpandedId(expandedId === r.id ? null : r.id)
    setNotesDraft(r.admin_notes || '')
  }

  if (loading) return <div className="text-white/40 text-sm py-10 text-center">Loading…</div>
  if (loadError) return <div className="text-rose-300 text-sm py-10 text-center">Couldn't load bounty requests: {loadError}</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by project or bounty title…" className="input w-full pl-9 text-sm" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="input w-auto text-sm">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', ...BOUNTY_HOSTING_REQUEST_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === s ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55 hover:bg-white/5'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}{s !== 'all' && ` (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No bounty hosting requests match this filter.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3 flex-1">
                  {r.logo_url && <img src={r.logo_url} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-semibold truncate">{r.title || 'Untitled bounty'}</h3>
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status]}`}>{r.status.replace('_', ' ')}</span>
                    </div>
                    <div className="text-white/50 text-xs mb-1">{r.project_name} · {r.category || '—'} · {r.total_reward} {r.reward_currency} · {r.num_winners} winner(s)</div>
                    <div className="text-white/35 text-[11px] font-mono">Deadline · {r.submission_deadline || '—'} · Submitted {new Date(r.created_at).toLocaleDateString()}</div>
                    {r.description && <p className="text-white/45 text-xs mt-2 max-w-2xl leading-relaxed line-clamp-2">{r.description}</p>}
                    {r.admin_notes && <p className="text-amber-200/70 text-xs mt-2 max-w-xl leading-relaxed border-l-2 border-amber-300/30 pl-2">Note: {r.admin_notes}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end lg:max-w-[320px]">
                  {r.status === 'pending_review' && (
                    <>
                      <button onClick={() => setStatus(r, 'approved')} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/25">Approve</button>
                      <button onClick={() => openNotes(r)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-sunset-amber/40 text-sunset-amber hover:bg-sunset-amber/10">Request Changes</button>
                      <button onClick={() => setStatus(r, 'rejected')} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-400/15 text-rose-300 border border-rose-400/30 hover:bg-rose-400/25">Reject</button>
                    </>
                  )}
                  {r.status === 'approved' && !r.published_bounty_id && (
                    <button onClick={() => publish(r)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple">Publish</button>
                  )}
                  {r.published_bounty_id && (
                    <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-emerald-300/30 text-emerald-300">Published</span>
                  )}
                  <button onClick={() => setEditing(r)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-purple-light/40 text-purple-light hover:bg-purple-light/10">Edit</button>
                  <button onClick={() => openNotes(r)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
                    {expandedId === r.id ? 'Close' : 'Notes'}
                  </button>
                  <select
                    value={r.assigned_admin ?? ''}
                    onChange={(e) => assignAdmin(r, e.target.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 bg-transparent text-white/60"
                  >
                    <option value="" className="bg-panel">Unassigned</option>
                    {staff.map((s) => <option key={s.id} value={s.id} className="bg-panel">{s.full_name || s.username || s.id.slice(0, 8)}</option>)}
                  </select>
                </div>
              </div>

              {expandedId === r.id && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={3}
                    placeholder="Internal notes, or feedback to send back to the project when requesting changes"
                    className="input w-full text-sm resize-y"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setStatus(r, 'changes_requested', notesDraft)} className="px-4 py-2 rounded-full text-xs font-semibold border border-sunset-amber/40 text-sunset-amber hover:bg-sunset-amber/10">
                      Send as "Request Changes"
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await runAdminAction(() => supabase.from('bounty_hosting_requests').update({ admin_notes: notesDraft || null }).eq('id', r.id), showToast, { successMessage: 'Notes saved' })
                        if (ok) { setExpandedId(null); await load() }
                      }}
                      className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple"
                    >
                      Save Notes Only
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && <RequestEditorModal request={editing} showToast={showToast} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  )
}

function RequestEditorModal({
  request,
  showToast,
  onClose,
  onSaved,
}: {
  request: BountyHostingRequest
  showToast: (msg: string) => void
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    project_name: request.project_name ?? '',
    title: request.title ?? '',
    description: request.description ?? '',
    category: request.category ?? 'Development',
    required_skills: request.required_skills ?? '',
    num_winners: request.num_winners ? String(request.num_winners) : '1',
    total_reward: request.total_reward ?? '',
    reward_currency: request.reward_currency ?? '',
    submission_deadline: request.submission_deadline ?? '',
  })

  function set<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('bounty_hosting_requests')
      .update({ ...draft, num_winners: parseInt(draft.num_winners, 10) || 1 })
      .eq('id', request.id)
    setSaving(false)
    if (error) { showToast(getErrorMessage(error, 'Could not save.')); return }
    showToast('Bounty request updated')
    await onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-squircle border border-white/10 bg-panel p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Edit before publishing</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EField label="Project Name" value={draft.project_name} onChange={(v) => set('project_name', v)} />
          <EField label="Bounty Title" value={draft.title} onChange={(v) => set('title', v)} />
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Category</label>
            <select value={draft.category} onChange={(e) => set('category', e.target.value)} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <EField label="Required Skills" value={draft.required_skills} onChange={(v) => set('required_skills', v)} />
          <EField label="Number of Winners" value={draft.num_winners} onChange={(v) => set('num_winners', v)} type="number" />
          <EField label="Total Reward" value={draft.total_reward} onChange={(v) => set('total_reward', v)} />
          <EField label="Reward Currency" value={draft.reward_currency} onChange={(v) => set('reward_currency', v)} />
          <EField label="Submission Deadline" value={draft.submission_deadline} onChange={(v) => set('submission_deadline', v)} type="date" />
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Description</label>
            <textarea value={draft.description} onChange={(e) => set('description', e.target.value)} rows={4} className="input resize-y" />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="input" />
    </div>
  )
}
