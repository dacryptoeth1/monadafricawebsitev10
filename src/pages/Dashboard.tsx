import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Copy, Trophy, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { AppNotification, Application, Bounty, Submission } from '../types'
import Reveal from '../components/Reveal'
import SubmissionModal from '../components/SubmissionModal'

interface AppRow extends Application {
  bounties: Pick<Bounty, 'title' | 'reward'> | null
}
interface SubRow extends Submission {
  bounties: Pick<Bounty, 'title'> | null
}

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth()
  const [applications, setApplications] = useState<AppRow[]>([])
  const [submissions, setSubmissions] = useState<SubRow[]>([])
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [submitFor, setSubmitFor] = useState<AppRow | null>(null)
  const [copied, setCopied] = useState(false)

  async function loadAll() {
    if (!profile) return
    const [{ data: apps }, { data: subs }, { data: notifs }] = await Promise.all([
      supabase.from('applications').select('*, bounties(title, reward)').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('submissions').select('*, bounties(title)').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').or(`user_id.eq.${profile.id},user_id.is.null`).order('created_at', { ascending: false }).limit(20),
    ])
    setApplications((apps as AppRow[]) ?? [])
    setSubmissions((subs as SubRow[]) ?? [])
    setNotifications((notifs as AppNotification[]) ?? [])
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
  const unreadCount = notifications.filter((n) => !n.read).length

  if (!profile || loading) {
    return <div className="min-h-screen flex items-center justify-center text-white/40 text-sm pt-20">Loading your dashboard…</div>
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="flex flex-wrap items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden text-xl font-display font-bold">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : (profile.username || profile.full_name || '?').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display font-semibold text-2xl">{profile.full_name || profile.username}</h1>
              <p className="text-white/40 text-sm">@{profile.username} · {profile.country} · {profile.role}</p>
            </div>
          </div>
          <Link to="/profile" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
            Edit Profile
          </Link>
        </Reveal>

        <Reveal className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <StatCard label="Credits" value={profile.credits} />
          <StatCard label="Referrals" value={profile.total_referrals} icon={Users} />
          <StatCard label="Applications" value={applications.length} />
          <StatCard label="Wins" value={wonCount} icon={Trophy} />
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Reveal>
            <h3 className="font-display font-semibold text-lg mb-4">Applied Bounties</h3>
            {applications.length === 0 ? (
              <EmptyRow text="No applications yet. Browse the bounty board to get started." />
            ) : (
              <div className="flex flex-col gap-2.5">
                {applications.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.bounties?.title ?? 'Bounty'}</div>
                      <div className="text-white/40 text-xs mt-0.5">{a.bounties?.reward}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill status={a.status} />
                      {a.status === 'approved' && !submissions.some((s) => s.application_id === a.id) && (
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
                    <div className="text-sm font-medium truncate">{s.bounties?.title ?? 'Bounty'}</div>
                    <StatusPill status={s.status} />
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        </div>

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

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon?: any }) {
  return (
    <div className="rounded-squircle border border-white/10 bg-gradient-to-b from-purple/10 to-transparent p-5 text-center">
      {Icon && <Icon size={16} className="mx-auto mb-2 text-purple-light" />}
      <div className="font-display font-semibold text-2xl">{value}</div>
      <div className="text-white/50 text-xs mt-1">{label}</div>
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

function EmptyRow({ text }: { text: string }) {
  return <div className="text-white/40 text-sm border border-dashed border-white/15 rounded-xl p-5">{text}</div>
}
