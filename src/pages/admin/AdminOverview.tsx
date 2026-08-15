import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import type { SiteSettings } from '../../types'
import { defaultSiteSettings } from '../../types'

const COLORS = ['#6E54FF', '#A99AFF', '#E8B75D', '#FF7A59', '#8C79FF', '#F2CE8C']

// Country/region breakdown and the signup trend charts use a bounded
// sample rather than the entire profiles table — exact totals (Total
// Users, Signups Today/Week/Month, Online Users) come from separate
// count-only queries below and are always accurate at any table size.
// This sample only feeds the two trend charts and the country pie —
// visualizations, not the headline numbers — so a bound here trades a
// small amount of chart precision at extreme scale for not pulling the
// whole users table into the browser on every Overview load.
const CHART_SAMPLE_LIMIT = 5000

interface TopUser {
  id: string
  full_name: string | null
  username: string | null
  total_referrals?: number
  last_seen?: string | null
}

export default function AdminOverview({ showToast }: { showToast: (msg: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)

  const [totalUsers, setTotalUsers] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState(0)
  const [daily, setDaily] = useState(0)
  const [weekly, setWeekly] = useState(0)
  const [monthly, setMonthly] = useState(0)

  const [totalBounties, setTotalBounties] = useState(0)
  const [activeBounties, setActiveBounties] = useState(0)
  const [completedBounties, setCompletedBounties] = useState(0)

  const [pendingSubs, setPendingSubs] = useState(0)
  const [approvedSubs, setApprovedSubs] = useState(0)
  const [rejectedSubs, setRejectedSubs] = useState(0)

  const [creditsIssued, setCreditsIssued] = useState(0)
  const [xpAwarded, setXpAwarded] = useState(0)

  const [countryRows, setCountryRows] = useState<{ country: string | null; region: string | null }[]>([])
  const [signupDates, setSignupDates] = useState<string[]>([])
  const [creditsSpent14d, setCreditsSpent14d] = useState<{ amount: number; created_at: string }[]>([])
  const [topContributors, setTopContributors] = useState<TopUser[]>([])
  const [mostActive, setMostActive] = useState<TopUser[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const now = new Date()
      const dayAgo = new Date(now.getTime() - 86400000).toISOString()
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString()
      const onlineCutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

      const results = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('last_seen', onlineCutoff),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', dayAgo),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
        supabase.from('bounties').select('*', { count: 'exact', head: true }),
        supabase.from('bounties').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_closed', false),
        supabase.from('bounties').select('*', { count: 'exact', head: true }).eq('is_closed', true),
        supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.rpc('admin_credit_totals').maybeSingle(),
        supabase.rpc('admin_xp_totals').maybeSingle(),
        supabase.from('profiles').select('country, region').order('created_at', { ascending: false }).limit(CHART_SAMPLE_LIMIT),
        supabase.from('profiles').select('created_at').order('created_at', { ascending: false }).limit(CHART_SAMPLE_LIMIT),
        supabase.from('credit_transactions').select('amount, created_at').lt('amount', 0).gte('created_at', fourteenDaysAgo),
        supabase.from('profiles').select('id, full_name, username, total_referrals').order('total_referrals', { ascending: false }).limit(5),
        supabase.from('profiles').select('id, full_name, username, last_seen').not('last_seen', 'is', null).order('last_seen', { ascending: false }).limit(5),
        supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
      ])

      if (cancelled) return

      const firstError = results.find((r: any) => r.error)?.error
      if (firstError) { console.error('Failed to load overview data:', firstError); showToast(firstError.message) }
      setLoadError(firstError?.message ?? null)

      const [
        totalUsersRes, onlineRes, dailyRes, weeklyRes, monthlyRes,
        totalBountiesRes, activeBountiesRes, completedBountiesRes,
        pendingSubsRes, approvedSubsRes, rejectedSubsRes,
        creditTotalsRes, xpTotalsRes,
        countryRes, signupsRes, creditsSpentRes, topContribRes, mostActiveRes,
        settingsRes,
      ] = results as any[]

      setTotalUsers(totalUsersRes.count ?? 0)
      setOnlineUsers(onlineRes.count ?? 0)
      setDaily(dailyRes.count ?? 0)
      setWeekly(weeklyRes.count ?? 0)
      setMonthly(monthlyRes.count ?? 0)
      setTotalBounties(totalBountiesRes.count ?? 0)
      setActiveBounties(activeBountiesRes.count ?? 0)
      setCompletedBounties(completedBountiesRes.count ?? 0)
      setPendingSubs(pendingSubsRes.count ?? 0)
      setApprovedSubs(approvedSubsRes.count ?? 0)
      setRejectedSubs(rejectedSubsRes.count ?? 0)
      setCreditsIssued(Number(creditTotalsRes.data?.issued ?? 0))
      setXpAwarded(Number(xpTotalsRes.data?.issued ?? 0))
      setCountryRows(countryRes.data ?? [])
      setSignupDates((signupsRes.data ?? []).map((r: { created_at: string }) => r.created_at))
      setCreditsSpent14d(creditsSpentRes.data ?? [])
      setTopContributors(topContribRes.data ?? [])
      setMostActive(mostActiveRes.data ?? [])
      if (settingsRes.data) setSettings(settingsRes.data as SiteSettings)

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const countries = useMemo(() => new Set(countryRows.map((p) => p.country).filter(Boolean)).size, [countryRows])
  const states = useMemo(() => new Set(countryRows.map((p) => p.region).filter(Boolean)).size, [countryRows])
  const communityMembers = settings.discord_members + settings.telegram_members + settings.x_followers

  const dailySignups = useMemo(() => {
    const days: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      days[d.toISOString().slice(0, 10)] = 0
    }
    signupDates.forEach((iso) => {
      const key = iso.slice(0, 10)
      if (key in days) days[key]++
    })
    return Object.entries(days).map(([date, count]) => ({ date: date.slice(5), count }))
  }, [signupDates])

  const monthlySignups = useMemo(() => {
    const months: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0
    }
    signupDates.forEach((iso) => {
      const key = iso.slice(0, 7)
      if (key in months) months[key]++
    })
    return Object.entries(months).map(([month, count]) => ({ month: month.slice(5), count }))
  }, [signupDates])

  const countryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    countryRows.forEach((p) => {
      if (p.country) counts[p.country] = (counts[p.country] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))
  }, [countryRows])

  const creditsSpentByDay = useMemo(() => {
    const days: Record<string, number> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      days[d.toISOString().slice(0, 10)] = 0
    }
    creditsSpent14d.forEach((c) => {
      const key = c.created_at.slice(0, 10)
      if (key in days) days[key] += Math.abs(c.amount)
    })
    return Object.entries(days).map(([date, count]) => ({ date: date.slice(5), count }))
  }, [creditsSpent14d])

  if (loading) return <div className="text-white/40 text-sm">Loading analytics…</div>

  return (
    <div>
      {loadError && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-xs text-rose-200">
          Some overview data couldn't be loaded: {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Total Users" value={totalUsers} />
        <Stat label="Community Members" value={communityMembers} />
        <Stat label="Online Users" value={onlineUsers} />
        <Stat label="Total Bounties" value={totalBounties} />
        <Stat label="Active Bounties" value={activeBounties} />
        <Stat label="Completed Bounties" value={completedBounties} />
        <Stat label="Pending Submissions" value={pendingSubs} />
        <Stat label="Approved Submissions" value={approvedSubs} />
        <Stat label="Rejected Submissions" value={rejectedSubs} />
        <Stat label="Credits Issued" value={creditsIssued} />
        <Stat label="XP Awarded" value={xpAwarded} />
        <Stat label="Countries" value={countries} />
        <Stat label="States / Regions" value={states} />
        <Stat label="Signups Today" value={daily} />
        <Stat label="Signups This Week" value={weekly} />
        <Stat label="Signups This Month" value={monthly} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartCard title="Daily Registrations (14 days)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailySignups}>
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={11} />
              <YAxis stroke="#ffffff40" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0F0B16', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#8C79FF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Registrations (6 months)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlySignups}>
              <XAxis dataKey="month" stroke="#ffffff40" fontSize={11} />
              <YAxis stroke="#ffffff40" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0F0B16', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" fill="#6E54FF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Users by Country">
          {countryBreakdown.length === 0 ? (
            <div className="text-white/30 text-sm py-10 text-center">No country data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={countryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(d: any) => d.name}>
                  {countryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0F0B16', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Credits Spent (14 days)">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={creditsSpentByDay}>
              <XAxis dataKey="date" stroke="#ffffff40" fontSize={11} />
              <YAxis stroke="#ffffff40" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0F0B16', border: '1px solid #ffffff20', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" fill="#E8B75D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ListCard title="Top Contributors (by referrals)" items={topContributors.map((p) => ({ label: p.full_name || p.username || 'Unnamed', value: `${p.total_referrals ?? 0} referrals` }))} />
        <ListCard title="Most Active Users" items={mostActive.map((p) => ({ label: p.full_name || p.username || 'Unnamed', value: p.last_seen ? timeAgo(p.last_seen) : '—' }))} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
      <div className="font-display font-semibold text-xl">{value}</div>
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

function ListCard({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h4 className="text-sm font-semibold mb-3">{title}</h4>
      {items.length === 0 ? (
        <div className="text-white/30 text-sm py-4 text-center">No data yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-white/70 truncate">{it.label}</span>
              <span className="text-white/40 text-xs shrink-0 ml-3">{it.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
