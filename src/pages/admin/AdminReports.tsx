import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Report } from '../../types'

export default function AdminReports({ showToast }: { showToast: (msg: string) => void }) {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  async function load() {
    let q = supabase.from('reports').select('*').order('created_at', { ascending: false })
    if (filter === 'open') q = q.eq('status', 'open')
    const { data, error } = await q
    if (error) { console.error('Failed to load reports:', error); showToast(error.message); setLoadError(error.message); setReports([]); return }
    setLoadError(null)
    setReports((data as Report[]) ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function updateStatus(id: string, status: 'resolved' | 'dismissed') {
    const { error } = await supabase.from('reports').update({ status }).eq('id', id)
    if (error) { showToast(error.message); return }
    await load()
    showToast(`Report ${status}`)
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setFilter('open')} className={`px-4 py-2 rounded-full text-xs font-semibold border ${filter === 'open' ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55'}`}>Open</button>
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-xs font-semibold border ${filter === 'all' ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55'}`}>All</button>
      </div>

      {reports === null ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : loadError ? (
        <div className="text-rose-300 text-sm py-10 text-center">Couldn't load reports: {loadError}</div>
      ) : reports.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">{filter === 'open' ? 'No open reports.' : 'No reports yet.'}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {r.target_type} report{' '}
                  <span className={`ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                    r.status === 'open' ? 'text-amber-300 border-amber-300/30' : r.status === 'resolved' ? 'text-emerald-300 border-emerald-300/30' : 'text-white/40 border-white/20'
                  }`}>{r.status}</span>
                </div>
                <div className="text-white/50 text-xs mt-1">{r.reason}</div>
                <div className="text-white/30 text-[11px] font-mono mt-1">target: {r.target_id.slice(0, 8)}… · {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              {r.status === 'open' && (
                <div className="flex gap-2 flex-none">
                  <button onClick={() => updateStatus(r.id, 'resolved')} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">Resolve</button>
                  <button onClick={() => updateStatus(r.id, 'dismissed')} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white/50">Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
