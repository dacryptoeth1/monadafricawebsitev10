import { getRank } from '../lib/rank'
import { flagFor } from '../lib/countryFlag'
import type { PublicProfile } from '../types'

// Shared between the /builders directory and the homepage's Builders
// preview section — kept as its own component (not defined inline in
// either page) so the homepage doesn't statically import the /builders
// route module just to reuse this card, which would drag that whole
// lazy-loaded page into the homepage's bundle.
export default function BuilderCard({ builder }: { builder: PublicProfile }) {
  const rank = getRank(builder.xp)
  const flag = flagFor(builder.country)

  return (
    <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full flex flex-col gap-4 hover:border-purple/40 hover:-translate-y-1 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-sm font-display font-bold">
          {builder.avatar_url ? <img src={builder.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (builder.username || '?').slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base truncate">{builder.full_name || builder.username || 'Unnamed'}</h3>
          {builder.country && (
            <span className="text-white/45 text-xs">{flag ? `${flag} ` : ''}{builder.country}</span>
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
