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

export const PULSE_CATEGORY_LABELS: Record<NonNullable<EcosystemActivity['pulse_category']>, string> = {
  event: 'Event',
  announcement: 'Announcement',
  network: 'Network',
  builder: 'Builders',
  ecosystem: 'Ecosystem',
  community: 'Community',
}

// Picks the single "Featured Moment" card for the top of /events —
// scored, not hardcoded, so it changes as new activity is published.
// Weighting, in order of what the redesign brief asked to prioritize:
//   1. A bare statistic (statistic_value set, no real narrative) is
//      deliberately scored lowest — it already gets its own compact
//      stat tile in the hero, so it shouldn't also "win" the one big
//      qualitative spotlight card.
//   2. status: live > upcoming > recent — a currently-live development
//      or a genuinely upcoming one both outrank something that already
//      happened.
//   3. data_freshness: live > periodic > curated — prefer something
//      still being kept in sync over a one-time hand-entry, all else
//      equal.
//   4. Recency (published_at) breaks any remaining tie, newest first —
//      this is what makes the featured card actually rotate over time
//      instead of freezing on whatever scored highest once.
export function featuredScore(item: EcosystemActivity): number {
  let score = 0
  if (item.status === 'live') score += 100
  else if (item.status === 'upcoming') score += 70
  else score += 40

  if (item.data_freshness === 'live') score += 15
  else if (item.data_freshness === 'periodic') score += 8

  if (item.statistic_value && !item.description) score -= 60

  return score
}

export function pickFeaturedMoment(items: EcosystemActivity[]): EcosystemActivity | null {
  if (items.length === 0) return null
  return [...items].sort((a, b) => {
    const scoreDiff = featuredScore(b) - featuredScore(a)
    if (scoreDiff !== 0) return scoreDiff
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  })[0]
}
