import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'

interface ActivityRow {
  id: string
  kind: 'credit' | 'xp' | 'application' | 'referral'
  label: string
  detail: string
  created_at: string
}

export default function ActivityHistory() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ActivityRow[] | null>(null)

  useEffect(() => {
    if (!profile) return
    async function load() {
      const [credits, xp, apps, referrals] = await Promise.all([
        supabase.from('credit_transactions').select('*').eq('user_id', profile!.id),
        supabase.from('xp_transactions').select('*').eq('user_id', profile!.id),
        supabase.from('applications').select('id, created_at, bounties(title)').eq('user_id', profile!.id),
        supabase.from('profiles').select('id, full_name, username, created_at').eq('referred_by', profile!.id),
      ])

      const merged: ActivityRow[] = [
        ...(credits.data ?? []).map((c: any) => ({
          id: `credit-${c.id}`,
          kind: 'credit' as const,
          label: c.amount >= 0 ? `+${c.amount} credit` : `${c.amount} credit`,
          detail: formatReason(c.reason),
          created_at: c.created_at,
        })),
        ...(xp.data ?? []).map((x: any) => ({
          id: `xp-${x.id}`,
          kind: 'xp' as const,
          label: x.amount >= 0 ? `+${x.amount} XP` : `${x.amount} XP`,
          detail: formatReason(x.reason),
          created_at: x.created_at,
        })),
        ...(apps.data ?? []).map((a: any) => ({
          id: `app-${a.id}`,
          kind: 'application' as const,
          label: 'Applied to bounty',
          detail: a.bounties?.title ?? 'Bounty',
          created_at: a.created_at,
        })),
        ...(referrals.data ?? []).map((r: any) => ({
          id: `ref-${r.id}`,
          kind: 'referral' as const,
          label: 'Referral joined',
          detail: r.full_name || r.username || 'New builder',
          created_at: r.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setRows(merged)
    }
    load()
  }, [profile?.id])

  if (!profile) return null

  const icons: Record<ActivityRow['kind'], string> = { credit: '⭐', xp: '🏅', application: '📨', referral: '👥' }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-2xl mx-auto px-6">
        <Reveal className="mb-10 text-center">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Your history</span>
          <h1 className="font-display font-semibold text-3xl mt-4">Activity</h1>
        </Reveal>

        {rows === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState Icon={Activity} message="No activity yet — apply to a bounty, refer a friend, or complete your profile to get started." />
        ) : (
          <Reveal className="flex flex-col gap-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0">{icons[r.kind]}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.label}</div>
                    <div className="text-white/40 text-xs truncate">{r.detail}</div>
                  </div>
                </div>
                <div className="text-white/30 text-xs font-mono shrink-0 ml-3">
                  {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </Reveal>
        )}
      </div>
    </section>
  )
}

function formatReason(reason: string): string {
  if (reason.startsWith('bounty_application:')) return 'Applied to a bounty'
  if (reason.startsWith('submission_approved:')) return 'Submission approved'
  if (reason === 'signup_bonus' || reason === 'signup_bonus_backfill') return 'Welcome bonus'
  if (reason === 'referral_bonus') return 'Referral bonus'
  if (reason === 'profile_complete_bonus') return 'Completed your profile'
  if (reason === 'admin_reset') return 'Reset by admin'
  if (reason === 'admin_adjustment') return 'Adjusted by admin'
  return reason.replace(/_/g, ' ')
}
