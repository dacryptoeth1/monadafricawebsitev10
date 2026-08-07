import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Badge, Profile } from '../types'
import { getRank } from '../lib/rank'

const COMPLETION_FIELDS = ['avatar_url', 'username', 'bio', 'country', 'region', 'wallet_address'] as const

export default function ProfileStatsHeader({ profile, badges }: { profile: Profile; badges: (Badge & { awarded_at: string })[] }) {
  const [appCounts, setAppCounts] = useState<{ total: number; approved: number; pending: number; rejected: number } | null>(null)
  const [rank, setRank] = useState<number | null>(null)

  useEffect(() => {
    supabase
      .from('applications')
      .select('status')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        const rows = data ?? []
        setAppCounts({
          total: rows.length,
          approved: rows.filter((r: any) => r.status === 'approved').length,
          pending: rows.filter((r: any) => r.status === 'pending').length,
          rejected: rows.filter((r: any) => r.status === 'rejected').length,
        })
      })
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('xp', profile.xp)
      .then(({ count }) => setRank((count ?? 0) + 1))
  }, [profile.id, profile.xp])

  const socialCount = [profile.twitter, profile.discord, profile.telegram, profile.github].filter(Boolean).length
  const hasSocial = socialCount > 0
  const filled = COMPLETION_FIELDS.filter((f) => !!(profile as any)[f]).length + (hasSocial ? 1 : 0)
  const completion = Math.round((filled / (COMPLETION_FIELDS.length + 1)) * 100)

  return (
    <div className="rounded-squircle border border-white/10 bg-panel/40 p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden text-lg font-display font-bold shrink-0">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (profile.username || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-display font-semibold text-lg truncate">👤 {profile.username || profile.full_name || 'Unnamed'}</div>
          <div className="text-white/40 text-xs mt-0.5">
            📅 Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            {profile.country && <> · 🌍 {profile.country}{profile.region ? `, 📍 ${profile.region}` : ''}</>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-5">
        <Stat emoji="⭐" label="Credits" value={profile.credits} />
        <Stat emoji="🏅" label="XP" value={profile.xp} />
        <Stat emoji={getRank(profile.xp).emoji} label="Rank" value={getRank(profile.xp).name} />
        <Stat emoji="🏆" label="Position" value={rank ?? '—'} prefix="#" />
        <Stat emoji="👥" label="Referrals" value={profile.total_referrals} />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat emoji="📨" label="Applied" value={appCounts?.total ?? '—'} small />
        <Stat emoji="✅" label="Approved" value={appCounts?.approved ?? '—'} small />
        <Stat emoji="⏳" label="Pending" value={appCounts?.pending ?? '—'} small />
        <Stat emoji="❌" label="Rejected" value={appCounts?.rejected ?? '—'} small />
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-mono uppercase tracking-wider text-white/40">🔥 Profile completion</span>
          <span className="text-xs font-mono text-purple-light">{completion}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-glow to-purple rounded-full transition-all" style={{ width: `${completion}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-white/40">🎁 Referral code</span>
        <code className="text-xs text-purple-light">{profile.referral_code}</code>
      </div>

      {profile.wallet_address && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-white/40">💰 Wallet</span>
          <code className="text-xs text-white/60 truncate max-w-[180px]">{profile.wallet_address}</code>
        </div>
      )}

      {badges.length > 0 && (
        <div className="pt-3 border-t border-white/10">
          <span className="text-xs font-mono uppercase tracking-wider text-white/40 block mb-2">🏅 Badges</span>
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b.code} title={b.description ?? ''} className="text-xs px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.03]">
                {b.emoji} {b.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ emoji, label, value, prefix, small }: { emoji: string; label: string; value: number | string; prefix?: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
      <div className={`font-display font-semibold ${small ? 'text-base' : 'text-lg'}`}>{prefix}{value}</div>
      <div className="text-white/40 text-[10px] mt-0.5">{emoji} {label}</div>
    </div>
  )
}
