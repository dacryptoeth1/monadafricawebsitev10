import { useEffect, useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'

const COLORS = ['#6E54FF', '#A99AFF', '#E8B75D', '#FF7A59', '#8C79FF', '#F2CE8C']

const XP_REASON_LABELS: Record<string, string> = {
  signup_bonus: 'Signup Bonus',
  referral_bonus: 'Referral',
  bounty_application: 'Bounty Application',
  first_submission_bonus: 'First Submission Bonus',
  submission_approved: 'Submission Approved',
  bounty_winner: 'Bounty Winner',
  profile_complete_bonus: 'Profile Complete',
  wallet_connect_bonus: 'Wallet Connect',
  admin_adjustment: 'Admin Adjustment',
  admin_reset: 'Admin Reset',
  community_campaign: 'Community Campaign',
}

interface FunnelStage {
  label: string
  count: number
}

interface CategoryStat {
  name: string
  total: number
  approved: number
  approvalRate: number
}

export default function AdminAnalytics({ showToast }: { showToast: (msg: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [funnel, setFunnel] = useState<FunnelStage[]>([])
  const [byCategory, setByCategory] = useState<CategoryStat[]>([])
  const [byDifficulty, setByDifficulty] = useState<CategoryStat[]>([])
  const [creditTotals, setCreditTotals] = useState({ issued: 0, spent: 0 })
  const [xpTotals, setXpTotals] = useState({ issued: 0, spent: 0 })
  const [xpByReason, setXpByReason] = useState<{ bucket: string; total: number }[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      // Funnel: each stage is a count-only query (head: true) — no rows
      // transferred, just the count from the response header. Cheap
      // regardless of table size.
      const [signups, applications, submissions, approved, winners] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('applications').select('*', { count: 'exact', head: true }),
        supabase.from('submissions').select('*', { count: 'exact', head: true }),
        supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('is_winner', true),
      ])
      const firstError = [signups, applications, submissions, approved, winners].find((r) => r.error)?.error
      if (firstError) showToast(firstError.message)

      // Category/difficulty breakdown: bounties table is small (tens to
      // low hundreds of rows in practice, unlike users/transactions), and
      // we only pull the 2 columns needed — light enough to aggregate
      // client-side rather than adding another SQL function for it.
      const { data: bounties, error: bountiesError } = await supabase.from('bounties').select('category, difficulty, status').eq('is_deleted', false)
      if (bountiesError) showToast(bountiesError.message)

      const [creditTotalsRes, xpTotalsRes, xpByReasonRes] = await Promise.all([
        supabase.rpc('admin_credit_totals').maybeSingle(),
        supabase.rpc('admin_xp_totals').maybeSingle(),
        supabase.rpc('admin_xp_by_reason'),
      ])
      if (creditTotalsRes.error) showToast(creditTotalsRes.error.message)
      if (xpTotalsRes.error) showToast(xpTotalsRes.error.message)
      if (xpByReasonRes.error) showToast(xpByReasonRes.error.message)

      const anyError = firstError || bountiesError || creditTotalsRes.error || xpTotalsRes.error || xpByReasonRes.error
      if (anyError) console.error('Failed to load analytics:', anyError)

      if (cancelled) return
      setLoadError(anyError?.message ?? null)

      setFunnel([
        { label: 'Signups', count: signups.count ?? 0 },
        { label: 'Applications', count: applications.count ?? 0 },
        { label: 'Submissions', count: submissions.count ?? 0 },
        { label: 'Approved', count: approved.count ?? 0 },
        { label: 'Winners', count: winners.count ?? 0 },
      ])

      function breakdown(rows: { category: string; difficulty: string; status: string }[] | null, key: 'category' | 'difficulty'): CategoryStat[] {
        const buckets: Record<string, { total: number; approved: number }> = {}
        ;(rows ?? []).forEach((r) => {
          const name = r[key] || 'Unspecified'
          if (!buckets[name]) buckets[name] = { total: 0, approved: 0 }
          buckets[name].total++
          if (r.status === 'approved') buckets[name].approved++
        })
        return Object.entries(buckets)
          .map(([name, v]) => ({ name, total: v.total, approved: v.approved, approvalRate: v.total ? Math.round((v.approved / v.total) * 100) : 0 }))
          .sort((a, b) => b.total - a.total)
      }
      setByCategory(breakdown(bounties as any, 'category'))
      setByDifficulty(breakdown(bounties as any, 'difficulty'))

      const creditTotalsData = creditTotalsRes.data as { issued: number; spent: number } | null
      const xpTotalsData = xpTotalsRes.data as { issued: number; spent: number } | null
      setCreditTotals({ issued: Number(creditTotalsData?.issued ?? 0), spent: Number(creditTotalsData?.spent ?? 0) })
      setXpTotals({ issued: Number(xpTotalsData?.issued ?? 0), spent: Number(xpTotalsData?.spent ?? 0) })
      setXpByReason(((xpByReasonRes.data as { bucket: string; total: number }[]) ?? []).filter((r) => r.total > 0))

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <div className="text-white/40 text-sm">Loading analytics…</div>

  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count))

  return (
    <div className="flex flex-col gap-8">
      {loadError && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
          Some analytics data couldn't be loaded: {loadError}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-3">Conversion Funnel</h4>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-col gap-3">
          {funnel.map((stage, i) => {
            const prev = i > 0 ? funnel[i - 1].count : stage.count
            const pctOfPrev = prev > 0 ? Math.round((stage.count / prev) * 100) : 0
            const widthPct = Math.max(4, Math.round((stage.count / maxFunnel) * 100))
            return (
              <div key={stage.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/70">{stage.label}</span>
                  <span className="text-white/40">
                    {stage.count} {i > 0 && <span className="ml-1">({pctOfPrev}% of {funnel[i - 1].label})</span>}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-glow to-purple" style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Approval Rate by Category">
          {byCategory.length === 0 ? (
            <div className="text-white/30 text-sm py-10 text-center">No bounty data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory}>
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={11} />
                <YAxis stroke="#ffffff40" fontSize={11} allowDecimals={false} unit="%" />
                <Tooltip contentStyle={{ background: '#0F0B16', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} formatter={(v: any) => `${v}%`} />
                <Bar dataKey="approvalRate" radius={[6, 6, 0, 0]}>
                  {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Approval Rate by Difficulty">
          {byDifficulty.length === 0 ? (
            <div className="text-white/30 text-sm py-10 text-center">No bounty data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byDifficulty}>
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={11} />
                <YAxis stroke="#ffffff40" fontSize={11} allowDecimals={false} unit="%" />
                <Tooltip contentStyle={{ background: '#0F0B16', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} formatter={(v: any) => `${v}%`} />
                <Bar dataKey="approvalRate" fill="#E8B75D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <p className="text-white/30 text-[11px] -mt-4">
        Note: approval rate is computed from current bounty status, not a time-series — the
        schema doesn't currently record when a bounty was approved, so "average time to
        approval" isn't available without a schema change.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h4 className="text-sm font-semibold mb-4">Credits Economy</h4>
          <div className="grid grid-cols-2 gap-4">
            <EconomyStat label="Issued" value={creditTotals.issued} tone="emerald" />
            <EconomyStat label="Spent" value={creditTotals.spent} tone="rose" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h4 className="text-sm font-semibold mb-4">XP Economy</h4>
          <div className="grid grid-cols-2 gap-4">
            <EconomyStat label="Awarded" value={xpTotals.issued} tone="emerald" />
            <EconomyStat label="Reclaimed / Removed" value={xpTotals.spent} tone="rose" />
          </div>
        </div>
      </div>

      <ChartCard title="XP by Source">
        {xpByReason.length === 0 ? (
          <div className="text-white/30 text-sm py-10 text-center">No XP activity yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, xpByReason.length * 40)}>
            <BarChart data={xpByReason.map((r) => ({ name: XP_REASON_LABELS[r.bucket] || r.bucket.replace(/_/g, ' '), total: r.total }))} layout="vertical" margin={{ left: 24 }}>
              <XAxis type="number" stroke="#ffffff40" fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="#ffffff40" fontSize={11} width={140} />
              <Tooltip contentStyle={{ background: '#0F0B16', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="total" fill="#8C79FF" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

function EconomyStat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'rose' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
      <div className={`font-display font-semibold text-xl ${tone === 'emerald' ? 'text-emerald-300' : 'text-rose-300'}`}>{value.toLocaleString()}</div>
      <div className="text-white/40 text-[11px] mt-1">{label}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h4 className="text-sm font-semibold mb-3">{title}</h4>
      {children}
    </div>
  )
}
