export interface RankTier {
  name: string
  min: number
  emoji: string
}

// Single source of truth for rank thresholds — used by Leaderboard,
// ProfileStatsHeader, and Dashboard so they can never disagree.
export const RANK_TIERS: RankTier[] = [
  { name: 'Rookie', min: 0, emoji: '🌱' },
  { name: 'Contributor', min: 100, emoji: '🔧' },
  { name: 'Builder', min: 300, emoji: '🏗️' },
  { name: 'Expert', min: 700, emoji: '⚡' },
  { name: 'Ambassador', min: 1500, emoji: '🤝' },
  { name: 'Legend', min: 3000, emoji: '👑' },
]

export function getRank(xp: number): RankTier {
  let current = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (xp >= tier.min) current = tier
  }
  return current
}

export function getNextRank(xp: number): { tier: RankTier; xpNeeded: number } | null {
  const next = RANK_TIERS.find((t) => t.min > xp)
  if (!next) return null
  return { tier: next, xpNeeded: next.min - xp }
}
