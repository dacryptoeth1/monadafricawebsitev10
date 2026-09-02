import type { EcosystemActivity } from '../types'

// Powers the "Live" / "Updated Xm ago" / "Curated" label on every
// activity card and stat — the whole point being that nothing is ever
// labeled "Live" unless it's genuinely still being kept in sync (see
// api/sync-ecosystem-tvl.ts). A 'live' row whose sync has gone stale
// for more than 24h falls back to a plain "Updated" label instead of
// still claiming to be live.
export function freshnessLabel(item: Pick<EcosystemActivity, 'data_freshness' | 'last_synced_at'>): string {
  const { data_freshness, last_synced_at } = item

  if (!last_synced_at) return 'Curated by Monad Africa'

  const ms = Date.now() - new Date(last_synced_at).getTime()
  const minutes = Math.max(0, Math.round(ms / 60000))
  const isStale = minutes > 60 * 24

  if (data_freshness === 'live' && !isStale) {
    if (minutes < 1) return 'Live · updated just now'
    if (minutes < 60) return `Live · updated ${minutes}m ago`
    const hours = Math.round(minutes / 60)
    return `Live · updated ${hours}h ago`
  }

  if (minutes < 60) return `Updated ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Updated ${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Updated yesterday' : `Updated ${days}d ago`
}

export const ACTIVITY_STATUS_STYLES: Record<EcosystemActivity['status'], string> = {
  live: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
  upcoming: 'text-purple-light border-purple/30 bg-purple/10',
  recent: 'text-white/50 border-white/20 bg-white/5',
}
