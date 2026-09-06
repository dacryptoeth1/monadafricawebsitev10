import { supabase } from './supabase'
import type { PublicProfile } from '../types'
import type { BuilderCardOverride } from '../components/BuilderCard'

// Single source of truth for the two real Monad Africa founders pinned
// to the top of every builder list — the homepage's "Meet the
// Builders" preview AND the full /builders directory both call
// `fetchFeaturedBuilders` below rather than each keeping their own copy
// of this data, so the two can never drift apart or disagree about who
// these two are.
//
// This is data about two REGISTERED COMMUNITY BUILDERS (real rows in
// `leaderboard_public`, keyed by their real username) — not the Monad
// Africa team roster (that's `team_members`, read separately by
// /team). The override only relabels what these two cards show (their
// real, already-published team role/project — see /team) on top of
// their own real profile (avatar, country, XP); every other builder
// renders with zero overrides, straight from their own row.
export const FEATURED_BUILDER_OVERRIDES: Record<string, BuilderCardOverride> = {
  Dacrypto: {
    role: 'Founder, Monad Africa',
    bio: "Founder of Monad Africa, building the gateway that connects the Monad ecosystem with Africa's builders and communities.",
    twitter: 'https://x.com/0xrhydar',
  },
  cryptotesteer: {
    name: 'CryptoTester',
    role: 'Co-founder, Monad Africa',
    project: 'Purple',
    bio: 'Primary contact for partnerships, sponsorships, collaborations, and ecosystem opportunities across Monad Africa.',
    twitter: 'https://x.com/cryptotesteer',
  },
}
export const FEATURED_USERNAMES = Object.keys(FEATURED_BUILDER_OVERRIDES)

/**
 * Real registered builders (`leaderboard_public`), ranked by XP, with
 * the two featured founders above pinned to the front regardless of
 * their own XP. Every other row is exactly what the query returns —
 * no invented users, no team data mixed in. Used by both Home.tsx
 * ("Meet the Builders") and Builders.tsx (the full directory) so the
 * homepage preview is always a true subset of the full page, never a
 * separately-curated list.
 */
export async function fetchFeaturedBuilders(limit: number): Promise<PublicProfile[]> {
  const { data } = await supabase.from('leaderboard_public').select('*').order('xp', { ascending: false }).limit(limit)
  const rows = (data as PublicProfile[]) ?? []

  // Guarantee both featured founders appear even if their real XP
  // wouldn't otherwise place them inside the top-`limit` cut — a
  // separate, tiny lookup rather than raising the limit for everyone
  // else (or, on the homepage's limit of 4, silently dropping one).
  const missing = FEATURED_USERNAMES.filter((u) => !rows.some((r) => r.username === u))
  const extra = missing.length > 0
    ? ((await supabase.from('leaderboard_public').select('*').in('username', missing)).data as PublicProfile[] | null) ?? []
    : []

  const all = [...rows, ...extra]
  const byUsername = new Map(all.map((r) => [r.username, r]))
  const featured = FEATURED_USERNAMES.map((u) => byUsername.get(u)).filter((r): r is PublicProfile => !!r)
  const rest = all.filter((r) => !FEATURED_USERNAMES.includes(r.username ?? ''))

  return [...featured, ...rest].slice(0, Math.max(limit, featured.length))
}
