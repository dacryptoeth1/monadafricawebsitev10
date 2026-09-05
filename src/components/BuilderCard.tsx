import { Link } from 'react-router-dom'
import { getRank } from '../lib/rank'
import CountryFlag from './CountryFlag'
import type { PublicProfile } from '../types'

// Shared between the /builders directory and the homepage's Builders
// preview section — kept as its own component (not defined inline in
// either page) so the homepage doesn't statically import the /builders
// route module just to reuse this card, which would drag that whole
// lazy-loaded page into the homepage's bundle.

/**
 * The line under a builder's name. Prefers their own self-selected role
 * (profiles.role, exposed publicly by migration 0049) and falls back to
 * the XP rank they've actually earned — never an invented job title, and
 * never blank.
 */
export function builderRoleLabel(builder: PublicProfile): string {
  if (builder.role) return builder.role
  return getRank(builder.xp).name
}

export default function BuilderCard({ builder }: { builder: PublicProfile }) {
  const rank = getRank(builder.xp)

  return (
    <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full flex flex-col gap-4 hover:border-purple/40 hover:-translate-y-1 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-sm font-display font-bold">
          {builder.avatar_url ? <img src={builder.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (builder.username || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base truncate">{builder.full_name || builder.username || 'Unnamed'}</h3>
          <span className="text-white/45 text-xs truncate block">{builderRoleLabel(builder)}</span>
          {builder.country && (
            <span className="text-white/45 text-xs flex items-center gap-1.5 mt-0.5">
              <CountryFlag country={builder.country} size={11} />
              <span className="truncate">{builder.country}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/60">{rank.emoji} {rank.name}</span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-auto text-sm">
        <span className="font-display font-semibold text-purple-light">{builder.xp} XP</span>
        <span className="text-white/40 text-xs">{builder.total_referrals} referral{builder.total_referrals === 1 ? '' : 's'}</span>
      </div>
    </div>
  )
}

/**
 * The compact one-line variant used in the homepage's "Featured
 * Builders" column — avatar, name, role, country flag, XP. Same real
 * `leaderboard_public` row as the full card above, just denser, and
 * deliberately the same shape as the reference design's builder rows.
 */
export function BuilderRow({ builder }: { builder: PublicProfile }) {
  return (
    <Link to="/builders" className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-display font-bold">
        {builder.avatar_url ? (
          <img src={builder.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          (builder.full_name || builder.username || '?').slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate group-hover:text-purple-light transition-colors">
          {builder.full_name || builder.username || 'Builder'}
        </div>
        <div className="text-white/40 text-xs flex items-center gap-1.5 min-w-0">
          <span className="truncate">{builderRoleLabel(builder)}</span>
          {builder.country && (
            <>
              <span className="text-white/20 shrink-0">·</span>
              <CountryFlag country={builder.country} size={10} />
              <span className="truncate">{builder.country}</span>
            </>
          )}
        </div>
      </div>
      <span className="text-[10px] font-mono px-2 py-1 rounded-full border border-purple/30 bg-purple/10 text-purple-light shrink-0">
        {builder.xp} XP
      </span>
    </Link>
  )
}
