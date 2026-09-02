import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Copy, Trophy, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getRank } from '../lib/rank'
import MonadMark from '../components/MonadMark'
import { useAuth } from '../context/AuthContext'
import type { AppNotification, Application, Bounty, CreditTransaction, Submission } from '../types'
import Reveal from '../components/Reveal'
import SubmissionModal from '../components/SubmissionModal'

interface AppRow extends Application {
  bounties: Pick<Bounty, 'title' | 'reward' | 'logo_url' | 'project_name' | 'is_closed' | 'is_deleted'> | null
}
interface SubRow extends Submission {
  bounties: Pick<Bounty, 'title' | 'logo_url' | 'project_name'> | null
}

const PROFILE_FIELDS = ['full_name', 'username', 'avatar_url', 'bio', 'country', 'region', 'role', 'twitter', 'telegram', 'discord', 'website'] as const

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth()
  const [applications, setApplications] = useState<AppRow[]>([])
  const [submissions, setSubmissions] = useState<SubRow[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [rank, setRank] = useState<number | null>(null)
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [submitFor, setSubmitFor] = useState<AppRow | null>(null)
  const [copied, setCopied] = useState(false)
  const [partnershipBountyCount, setPartnershipBountyCount] = useState(0)

  async function loadAll() {
    if (!profile) return
    const [{ data: apps }, { data: subs }, { data: notifs }, { count: betterCount }, { data: credits }, { count: pCount }, { count: rCount }] = await Promise.all([
      supabase.from('applications').select('*, bounties(title, reward, logo_url, project_name, is_closed, is_deleted)').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('submissions').select('*, bounties(title, logo_url, project_name)').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').or(`user_id.eq.${profile.id},user_id.is.null`).order('created_at', { ascending: false }).limit(20),
      // leaderboard_public, not profiles — profiles only lets a row's
      // owner read it, so this always came back as "0 users have more
      // XP than me" (i.e. rank #1) for literally every user before the
      // public view existed. See migration 0032.
      supabase.from('leaderboard_public').select('id', { count: 'exact', head: true }).gt('xp', profile.xp),
      supabase.from('credit_transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(15),
      // Partnership/bounty-hosting applications — see migration 0037 and
      // ProjectBountyDashboard.tsx (linked below).
      supabase.from('partnership_applications').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
      supabase.from('bounty_hosting_requests').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
    ])
    setApplications((apps as AppRow[]) ?? [])
    setSubmissions((subs as SubRow[]) ?? [])
    setNotifications((notifs as AppNotification[]) ?? [])
    setRank((betterCount ?? 0) + 1)
    setCreditHistory((credits as CreditTransaction[]) ?? [])
    setPartnershipBountyCount((pCount ?? 0) + (rCount ?? 0))
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [profile?.id])

  async function markAllRead() {
    if (!profile) return
    const unread = notifications.filter((n) => !n.read && n.user_id === profile.id)
    if (unread.length === 0) return
    await Promise.all(unread.map((n) => supabase.from('notifications').update({ read: true }).eq('id', n.id)))
    loadAll()
  }

  function copyReferral() {
    if (!profile?.referral_code) return
    const link = `${window.location.origin}/signup?ref=${profile.referral_code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const wonCount = submissions.filter((s) => s.status === 'approved').length
  const pendingSubs = submissions.filter((s) => s.status === 'pending').length
  const rejectedSubs = submissions.filter((s) => s.status === 'rejected').length
  const unreadCount = notifications.filter((n) => !n.read).length

  const profileCompletion = profile
    ? Math.round((PROFILE_FIELDS.filter((f) => !!(profile as any)[f]).length / PROFILE_FIELDS.length) * 100)
    : 0

  if (!profile || loading) {
    return <div className="min-h-screen flex items-center justify-center text-white/40 text-sm pt-20">Loading your dashboard…</div>
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="flex flex-wrap items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden text-xl font-display font-bold">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (profile.username || profile.full_name || '?').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display font-semibold text-2xl flex items-center gap-2">
                {profile.full_name || profile.username} <MonadMark size={18} />
              </h1>
              <p className="text-white/40 text-sm">
                @{profile.username} · {profile.country}{profile.region ? `, ${profile.region}` : ''} · {profile.role}
              </p>
              <p className="text-white/30 text-xs mt-1 font-mono">Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/activity" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
              Activity
            </Link>
            <Link to="/profile" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
              Edit Profile
            </Link>
          </div>
        </Reveal>

        <Reveal className="rounded-squircle border border-white/10 bg-white/[0.02] p-5 mb-12">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-white/40">Profile completion</span>
            <span className="text-xs font-mono text-purple-light">{profileCompletion}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-glow to-purple rounded-full transition-all" style={{ width: `${profileCompletion}%` }} />
          </div>
        </Reveal>

        <Reveal className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <StatCard label="Credits" value={profile.credits} />
          <StatCard label="XP" value={profile.xp} />
          <StatCard label="Rank" value={getRank(profile.xp).name} />
          <StatCard label="Position" value={rank ?? 0} prefix="#" />
          <StatCard label="Referrals" value={profile.total_referrals} icon={Users} />
          <StatCard label="Wins" value={wonCount} icon={Trophy} />
        </Reveal>

        <Reveal className="grid grid-cols-3 gap-4 mb-12">
          <StatCard label="Total Submissions" value={submissions.length} small />
          <StatCard label="Pending" value={pendingSubs} small />
          <StatCard label="Rejected" value={rejectedSubs} small />
        </Reveal>

        <Reveal className="rounded-squircle border border-white/10 bg-panel/40 p-6 mb-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold mb-1">Your referral code</h3>
            <p className="text-white/40 text-xs">Share this link — you earn 1 credit for every signup.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="px-4 py-2.5 rounded-full bg-white/5 border border-white/15 text-sm text-purple-light">{profile.referral_code}</code>
            <button onClick={copyReferral} className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors">
              <Copy size={15} />
            </button>
            {copied && <span className="text-xs text-emerald-300">Copied!</span>}
          </div>
        </Reveal>

        <Reveal className="rounded-squircle border border-white/10 bg-panel/40 p-6 mb-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold mb-1">Partnerships & bounty hosting</h3>
            <p className="text-white/40 text-xs">
              {partnershipBountyCount > 0
                ? 'Track your applications, or manage your bounty once it\'s live.'
                : 'Represent a project? Apply to partner with Monad Africa or host a bounty.'}
            </p>
          </div>
          <div className="flex gap-2">
            {partnershipBountyCount > 0 ? (
              <Link to="/my-bounty" className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple">View dashboard</Link>
            ) : (
              <>
                <Link to="/partners#partner-form" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/10 transition-colors">Partner With Us</Link>
                <Link to="/host-bounty" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/10 transition-colors">Host a Bounty</Link>
              </>
            )}
          </div>
        </Reveal>

        {(profile.telegram || profile.discord || profile.twitter || profile.website) && (
          <Reveal className="flex flex-wrap gap-3 mb-12">
            {profile.twitter && <InfoChip label="X" value={profile.twitter} />}
            {profile.telegram && <InfoChip label="Telegram" value={profile.telegram} />}
            {profile.discord && <InfoChip label="Discord" value={profile.discord} />}
            {profile.website && <InfoChip label="Website" value={profile.website} />}
          </Reveal>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Reveal>
            <h3 className="font-display font-semibold text-lg mb-4">Applied Bounties</h3>
            {applications.length === 0 ? (
              <EmptyRow text="No applications yet. Browse the bounty board to get started." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {applications.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-bold">
                        {a.bounties?.logo_url ? <img src={a.bounties.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (a.bounties?.project_name || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{a.bounties?.title ?? 'Bounty'}</div>
                        <div className="text-white/40 text-xs mt-0.5">{a.bounties?.reward}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill status={a.status} />
                      {/* `a.bounties` comes back null (not an object with
                          is_deleted: true) when the bounty behind this
                          application has been soft-deleted — RLS hides the
                          embedded row entirely rather than exposing it with
                          a flag. Both that case and the ordinary "closed"
                          case need to block the Submit button the same way. */}
                      {(a.bounties?.is_closed || !a.bounties) && (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/20 text-white/40">
                          {a.bounties ? 'Closed' : 'Unavailable'}
                        </span>
                      )}
                      {a.status === 'approved' && a.bounties && !a.bounties.is_closed && !submissions.some((s) => s.application_id === a.id) && (
                        <button onClick={() => setSubmitFor(a)} className="text-xs font-semibold text-purple-light hover:text-white">Submit →</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Reveal>

          <Reveal>
            <h3 className="font-display font-semibold text-lg mb-4">Submitted Work</h3>
            {submissions.length === 0 ? (
              <EmptyRow text="No submissions yet." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {submissions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-bold">
                        {s.bounties?.logo_url ? <img src={s.bounties.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (s.bounties?.project_name || '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="text-sm font-medium truncate">{s.bounties?.title ?? 'Bounty'}</div>
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        </div>

        <Reveal className="mb-12">
          <h3 className="font-display font-semibold text-lg mb-4">Credit History</h3>
          {creditHistory.length === 0 ? (
            <EmptyRow text="No credit activity yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {creditHistory.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <span className="text-sm text-white/60">{formatReason(t.reason)}</span>
                  <span className={`font-mono text-sm font-semibold ${t.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {t.amount >= 0 ? '+' : ''}{t.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg flex items-center gap-2">
              <Bell size={17} /> Notifications {unreadCount > 0 && <span className="text-xs bg-purple text-white rounded-full px-2 py-0.5">{unreadCount}</span>}
            </h3>
            {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-purple-light hover:text-white">Mark all read</button>}
          </div>
          {notifications.length === 0 ? (
            <EmptyRow text="Nothing yet — you'll see updates about bounties, submissions, and referrals here." />
          ) : (
            <div className="flex flex-col gap-2">
              {notifications.map((n) => (
                <div key={n.id} className={`rounded-xl border p-4 ${n.read ? 'border-white/10 bg-white/[0.02]' : 'border-purple/30 bg-purple/5'}`}>
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.message && <div className="text-white/50 text-xs mt-1">{n.message}</div>}
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>

      {submitFor && (
        <SubmissionModal
          application={submitFor}
          onClose={() => setSubmitFor(null)}
          onSubmitted={() => {
            setSubmitFor(null)
            loadAll()
            refreshProfile()
          }}
        />
      )}
    </section>
  )
}

function StatCard({ label, value, icon: Icon, prefix, small }: { label: string; value: number | string; icon?: any; prefix?: string; small?: boolean }) {
  return (
    <div className={`rounded-squircle border border-white/10 bg-gradient-to-b from-purple/10 to-transparent text-center ${small ? 'p-4' : 'p-5'}`}>
      {Icon && <Icon size={16} className="mx-auto mb-2 text-purple-light" />}
      <div className={`font-display font-semibold ${small ? 'text-xl' : 'text-2xl'}`}>{prefix}{value}</div>
      <div className="text-white/50 text-xs mt-1">{label}</div>
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 rounded-full border border-white/10 bg-white/[0.02] text-xs">
      <span className="text-white/40 font-mono uppercase mr-2">{label}</span>
      <span className="text-white/70">{value}</span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
    approved: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
    rejected: 'text-rose-300 border-rose-300/30 bg-rose-300/10',
  }
  return <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${styles[status] || styles.pending}`}>{status}</span>
}

function formatReason(reason: string): string {
  if (reason.startsWith('bounty_application:')) return 'Applied to a bounty'
  if (reason === 'signup_bonus') return 'Welcome bonus'
  if (reason === 'referral_bonus') return 'Referral bonus'
  if (reason === 'admin_adjustment') return 'Adjusted by admin'
  return reason.replace(/_/g, ' ')
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-white/40 text-sm border border-dashed border-white/15 rounded-xl p-5">{text}</div>
}
