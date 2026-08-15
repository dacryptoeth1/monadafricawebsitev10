import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const PAGE_SIZE = 50

interface LedgerRow {
  id: string
  amount: number
  reason: string
  created_at: string
  profiles: { username: string | null; full_name: string | null } | null
}

export default function AdminCredits({ showToast }: { showToast: (msg: string) => void }) {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [totals, setTotals] = useState<{ issued: number; spent: number } | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    // Server-side sum via a SQL aggregate RPC instead of pulling every
    // transaction row to the browser just to add them up — scales to
    // any transaction volume, admin_credit_totals() is is_admin()-gated.
    supabase.rpc('admin_credit_totals').maybeSingle().then(({ data, error }) => {
      if (error) { showToast(error.message); return }
      const totals = data as { issued: number; spent: number } | null
      setTotals({ issued: Number(totals?.issued ?? 0), spent: Number(totals?.spent ?? 0) })
    })
    loadPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadPage(p: number) {
    p === 0 ? setLoading(true) : setLoadingMore(true)
    const from = p * PAGE_SIZE
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('id, amount, reason, created_at, profiles(username, full_name)')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('Failed to load credit transactions:', error)
      showToast(error.message)
      setLoadError(error.message)
      setLoading(false)
      setLoadingMore(false)
      return
    }
    setLoadError(null)
    const fetched = (data as unknown as LedgerRow[]) ?? []
    setRows((prev) => (p === 0 ? fetched : [...prev, ...fetched]))
    setHasMore(fetched.length === PAGE_SIZE)
    setPage(p)
    setLoading(false)
    setLoadingMore(false)
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-md">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
          <div className="font-display font-semibold text-2xl text-emerald-300">{totals?.issued ?? '—'}</div>
          <div className="text-white/40 text-xs mt-1">Total Credits Issued</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
          <div className="font-display font-semibold text-2xl text-rose-300">{totals?.spent ?? '—'}</div>
          <div className="text-white/40 text-xs mt-1">Total Credits Spent</div>
        </div>
      </div>

      <h4 className="text-xs font-mono uppercase text-white/40 mb-3">Recent Activity</h4>
      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : loadError ? (
        <div className="text-rose-300 text-sm py-10 text-center">Couldn't load credit activity: {loadError}</div>
      ) : rows.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No credit activity yet.</div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{r.profiles?.full_name || r.profiles?.username || 'Unknown user'}</span>
                  <span className="text-white/40"> · {r.reason.replace(/_/g, ' ')} · {new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <span className={`font-mono shrink-0 ml-3 ${r.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {r.amount >= 0 ? '+' : ''}{r.amount}
                </span>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => loadPage(page + 1)}
              disabled={loadingMore}
              className="mt-4 w-full px-4 py-2.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
