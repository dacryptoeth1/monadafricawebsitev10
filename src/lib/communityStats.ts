import type { CommunityStat, CommunityStatPlatform } from '../types'

export interface PlatformStat {
  count: number
  /** True when backed by a real community_stats row (a real sync ran) — false means this is the manual site_settings fallback. */
  isLive: boolean
  recordedAt: string | null
  deltaToday: number | null
  deltaWeek: number | null
}

// Turns a platform's snapshot history (any order) into "current count +
// how fresh + real growth deltas" — never estimates a delta it can't
// compute from an actual earlier snapshot (no snapshot old enough yet
// just means that delta is omitted, not guessed).
export function computePlatformStat(platform: CommunityStatPlatform, history: CommunityStat[], fallbackCount: number): PlatformStat {
  const rows = history.filter((h) => h.platform === platform).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
  if (rows.length === 0) {
    return { count: fallbackCount, isLive: false, recordedAt: null, deltaToday: null, deltaWeek: null }
  }
  const latest = rows[0]
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const closestBefore = (cutoff: number) => rows.find((r) => new Date(r.recorded_at).getTime() <= cutoff) ?? null
  const dayRow = closestBefore(dayAgo)
  const weekRow = closestBefore(weekAgo)
  return {
    count: latest.count,
    isLive: true,
    recordedAt: latest.recorded_at,
    deltaToday: dayRow ? latest.count - dayRow.count : null,
    deltaWeek: weekRow ? latest.count - weekRow.count : null,
  }
}

export function freshnessFromTimestamp(iso: string | null): string {
  if (!iso) return 'Manual'
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Updated just now'
  if (minutes < 60) return `Updated ${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Updated ${hours}h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Updated yesterday' : `Updated ${days}d ago`
}
