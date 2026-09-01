import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import { PARTNERSHIP_APPLICATION_STATUSES, type PartnershipApplication, type PartnershipApplicationStatus } from '../../types'

const STATUS_STYLES: Record<PartnershipApplicationStatus, string> = {
  'Pending Review': 'text-amber-300 border-amber-300/30',
  'Contacted': 'text-sky-300 border-sky-300/30',
  'Under Discussion': 'text-purple-light border-purple/30',
  'Approved': 'text-emerald-300 border-emerald-300/30',
  'Rejected': 'text-rose-300 border-rose-300/30',
  'Active Partnership': 'text-gold border-gold/40',
}

// Manages public.partnership_applications (migration 0037) — the
// signed-in "Partner With Us" application flow. Replaces the previous
// version of this file, which managed the old anonymous
// partnership_submissions table (left untouched/historical below).
export default function AdminPartnerships({ showToast }: { showToast: (msg: string) => void }) {
  const [items, setItems] = useState<PartnershipApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PartnershipApplicationStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  async function load() {
    setLoading(true)
    let query = supabase.from('partnership_applications').select('*').order('created_at', { ascending: false })
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (search.trim()) {
      const q = search.trim().replace(/[%_,()]/g, (c) => `\\${c}`)
      query = query.or(`project_name.ilike.%${q}%,contact_email.ilike.%${q}%,contact_person.ilike.%${q}%`)
    }
    const { data, error } = await query
    if (error) { console.error('Failed to load partnership applications:', error); showToast(error.message) }
    setLoadError(error?.message ?? null)
    setItems((data as PartnershipApplication[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter])

  async function changeStatus(item: PartnershipApplication, status: PartnershipApplicationStatus) {
    const ok = await runAdminAction(
      () => supabase.from('partnership_applications').update({ status }).eq('id', item.id),
      showToast,
      { successMessage: `Marked ${status}` },
    )
    if (ok) await load()
  }

  function openNotes(item: PartnershipApplication) {
    setExpandedId(expandedId === item.id ? null : item.id)
    setNotesDraft(item.admin_notes || '')
  }

  async function saveNotes(item: PartnershipApplication) {
    const ok = await runAdminAction(
      () => supabase.from('partnership_applications').update({ admin_notes: notesDraft || null }).eq('id', item.id),
      showToast,
      { successMessage: 'Notes saved' },
    )
    if (ok) { setExpandedId(null); await load() }
  }

  async function deleteItem(item: PartnershipApplication) {
    const ok = await runAdminAction(
      () => supabase.from('partnership_applications').delete().eq('id', item.id),
      showToast,
      { confirmMessage: `Permanently delete this application from ${item.project_name}?`, successMessage: 'Application deleted' },
    )
    if (ok) await load()
  }

  function exportCsv() {
    const headers = ['id', 'project_name', 'contact_person', 'contact_email', 'x_username', 'telegram', 'website', 'partnership_type', 'category', 'status', 'admin_notes', 'created_at']
    const rows = items.map((s) =>
      headers.map((h) => `"${String((s as any)[h] ?? '').replace(/"/g, '""')}"`).join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monad-africa-partnership-applications-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by project, contact, or email…"
          className="input flex-1 min-w-[220px]"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="input w-auto text-sm">
          <option value="all">All statuses</option>
          {PARTNERSHIP_APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exportCsv} disabled={items.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-40">
          <Download size={13} /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm py-10 text-center">Loading…</div>
      ) : loadError ? (
        <div className="text-rose-300 text-sm py-10 text-center">Couldn't load applications: {loadError}</div>
      ) : items.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No partnership applications found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex items-start gap-3">
                  {s.logo_url && <img src={s.logo_url} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-sm flex items-center gap-2 flex-wrap">
                      {s.project_name}
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                    </div>
                    <div className="text-white/40 text-xs mt-1">{s.contact_person} · {s.contact_email} · {s.partnership_type} · {new Date(s.created_at).toLocaleDateString()}</div>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      {s.x_username && <a href={s.x_username.startsWith('http') ? s.x_username : `https://x.com/${s.x_username.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">X</a>}
                      {s.telegram && <a href={s.telegram} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">Telegram</a>}
                      {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">Website</a>}
                    </div>
                    {s.description && <p className="text-white/55 text-xs mt-2 max-w-xl leading-relaxed whitespace-pre-line">{s.description}</p>}
                    {(s.needs_from_us || s.offers_to_us) && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl text-xs text-white/45">
                        {s.needs_from_us && <div><span className="text-white/30">Needs: </span>{s.needs_from_us}</div>}
                        {s.offers_to_us && <div><span className="text-white/30">Offers: </span>{s.offers_to_us}</div>}
                      </div>
                    )}
                    {s.admin_notes && <p className="text-amber-200/70 text-xs mt-2 max-w-xl leading-relaxed border-l-2 border-amber-300/30 pl-2">Note: {s.admin_notes}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 flex-none items-start">
                  <select
                    value={s.status}
                    onChange={(e) => changeStatus(s, e.target.value as PartnershipApplicationStatus)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-purple/30 text-purple-light bg-transparent"
                  >
                    {PARTNERSHIP_APPLICATION_STATUSES.map((st) => <option key={st} value={st} className="bg-panel">{st}</option>)}
                  </select>
                  <button onClick={() => openNotes(s)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
                    {expandedId === s.id ? 'Close' : 'Notes'}
                  </button>
                  <button onClick={() => deleteItem(s)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-rose-400/30 text-rose-300 hover:bg-rose-400/10">Delete</button>
                </div>
              </div>

              {expandedId === s.id && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={3}
                    placeholder="Internal notes — not visible to the applicant"
                    className="input w-full text-sm resize-y"
                  />
                  <div>
                    <button onClick={() => saveNotes(s)} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple">Save Notes</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
