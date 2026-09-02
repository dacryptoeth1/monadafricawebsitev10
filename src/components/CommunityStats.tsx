import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { computePlatformStat, freshnessFromTimestamp, type PlatformStat } from '../lib/communityStats'
import Counter from './Counter'
import type { CommunityStat, SiteSettings } from '../types'

// Real Monad Africa X/Discord/Telegram counts — reads community_stats
// (migration 0044), a table only scripts/sync-community-stats.mjs (run
// by GitHub Actions, see .github/workflows/sync-community-stats.yml)
// can write to (RLS has no admin policy, service-role only), so what's
// shown here can't drift from what the platforms actually report. A
// platform with no snapshot yet (sync not configured) falls back to site_settings'
// existing manual field, clearly labeled "Manual" instead of implying
// it's live. Used both on the homepage (compact) and /community (full).
export default function CommunityStats({ settings, compact = false }: { settings: SiteSettings; compact?: boolean }) {
  const [history, setHistory] = useState<CommunityStat[] | null>(null)

  useEffect(() => {
    // 8 days is enough to compute both "+today" and "+this week" deltas
    // per platform without pulling unbounded history.
    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('community_stats')
      .select('*')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => setHistory((data as CommunityStat[]) ?? []))
  }, [])

  if (history === null) {
    return (
      <div className={compact ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-3 gap-5'}>
        {[0, 1, 2].map((i) => <div key={i} className={`rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse ${compact ? 'h-20' : 'h-28'}`} />)}
      </div>
    )
  }

  const x = computePlatformStat('x', history, settings.x_followers)
  const discord = computePlatformStat('discord', history, settings.discord_members)
  const telegram = computePlatformStat('telegram', history, settings.telegram_members)

  const platforms = [
    { key: 'x', label: 'X', unit: 'Followers', stat: x, icon: null as null },
    { key: 'discord', label: 'Discord', unit: 'Members', stat: discord, icon: MessageCircle },
    { key: 'telegram', label: 'Telegram', unit: 'Members', stat: telegram, icon: Send },
  ]

  return (
    <div className={compact ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-1 sm:grid-cols-3 gap-5'}>
      {platforms.map((p) => (
        <div key={p.key} className={`rounded-2xl border border-white/10 bg-white/[0.02] ${compact ? 'p-4' : 'p-6'}`}>
          <div className="flex items-center gap-2 mb-2">
            {p.icon ? <p.icon size={compact ? 13 : 15} className="text-purple-light shrink-0" /> : <span className="text-purple-light text-xs font-bold shrink-0">𝕏</span>}
            <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{p.label}</span>
          </div>
          <div className={`font-display font-semibold ${compact ? 'text-xl' : 'text-2xl'}`}>
            <Counter value={p.stat.count} />
          </div>
          <div className={`text-white/40 ${compact ? 'text-[11px]' : 'text-xs'} mt-0.5`}>{p.unit}</div>
          {/* Freshness/"last updated" shown in both modes (previously
              compact mode hid this entirely) — a stale-data indicator is
              part of the honesty contract here, not just a detail view. */}
          <div className={`flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/10 ${compact ? 'gap-2' : 'gap-3'}`}>
            <span className={`font-mono uppercase px-2 py-0.5 rounded-full border ${compact ? 'text-[9px]' : 'text-[10px]'} ${p.stat.isLive ? 'text-emerald-300 border-emerald-300/30' : 'text-white/40 border-white/20'}`}>
              {p.stat.isLive ? freshnessFromTimestamp(p.stat.recordedAt) : 'Manual'}
            </span>
            {!compact && p.stat.deltaToday !== null && p.stat.deltaToday !== 0 && (
              <span className="text-emerald-300 text-xs font-mono">{p.stat.deltaToday > 0 ? '+' : ''}{p.stat.deltaToday} today</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export type { PlatformStat }
