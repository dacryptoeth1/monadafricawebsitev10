import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { getRank } from '../lib/rank'
import { toAbsoluteUrl, toXProfileUrl } from '../lib/socialLinks'
import CountryFlag from './CountryFlag'
import BuilderModal from './BuilderModal'
import type { PublicProfile } from '../types'

// Shared between the /builders directory, /community's "Top
// contributors", and the homepage's Explore Builders preview — kept as
// its own component (not defined inline in any one page) so those pages
// don't statically import each other's route module just to reuse this
// card, which would drag a whole lazy-loaded page into another page's
// bundle.

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

// A curated override for exactly one builder's card — used only for the
// two real Monad Africa founders featured at the top of /builders (see
// FEATURED_BUILDER_OVERRIDES in Builders.tsx). Every field is optional:
// a builder with no override just renders straight from their own real
// `leaderboard_public` row, same as before.
export interface BuilderCardOverride {
  name?: string
  role?: string
  project?: string
  bio?: string
  twitter?: string
}

export default function BuilderCard({ builder, override }: { builder: PublicProfile; override?: BuilderCardOverride }) {
  const rank = getRank(builder.xp)
  const [open, setOpen] = useState(false)

  const name = override?.name || builder.full_name || builder.username || 'Unnamed'
  const roleLabel = override?.role || builderRoleLabel(builder)
  const project = override?.project || builder.project_or_company
  const bio = override?.bio || builder.bio
  const twitterRaw = override?.twitter || builder.twitter
  const twitter = twitterRaw ? toXProfileUrl(twitterRaw) : null
  const website = builder.website ? toAbsoluteUrl(builder.website) : null

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`View ${name}'s profile`}
        className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full flex flex-col gap-4 hover:border-purple/40 hover:-translate-y-1 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-sm font-display font-bold">
            {builder.avatar_url ? <img src={builder.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-base truncate">{name}</h3>
            <span className="text-white/45 text-xs truncate block">{roleLabel}</span>
            {builder.country && (
              <span className="text-white/45 text-xs flex items-center gap-1.5 mt-0.5">
                <CountryFlag country={builder.country} size={11} />
                <span className="truncate">{builder.country}</span>
              </span>
            )}
          </div>
        </div>

        {project && (
          <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-purple/30 bg-purple/10 text-purple-light self-start truncate max-w-full">
            Building {project}
          </span>
        )}

        {bio && <p className="text-white/55 text-sm leading-relaxed line-clamp-2">{bio}</p>}

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/60">{rank.emoji} {rank.name}</span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-auto gap-3">
          <span className="font-display font-semibold text-purple-light text-sm shrink-0">{builder.xp} XP</span>
          <div className="flex items-center gap-2 shrink-0">
            {twitter && (
              <a
                href={twitter}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`${name} on X`}
                title="X (Twitter)"
                className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-purple/40 transition-colors text-xs font-bold"
              >
                𝕏
              </a>
            )}
            {website && (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={`${name}'s website`}
                title="Website"
                className="w-8 h-8 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-purple/40 transition-colors"
              >
                <Globe size={13} />
              </a>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <BuilderModal
            builder={builder}
            name={name}
            roleLabel={roleLabel}
            project={project}
            bio={bio}
            twitter={twitter}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * The compact one-line variant used in the homepage's "Meet the
 * Builders" column — avatar, name, role, country flag, XP. Same real
 * `leaderboard_public` row as the full card above, just denser, and
 * deliberately the same shape as the reference design's builder rows.
 * Accepts the same optional `override` as the full card so the two
 * featured founders (see featuredBuilders.ts) read identically whether
 * shown here or on the full /builders directory.
 */
export function BuilderRow({ builder, override }: { builder: PublicProfile; override?: BuilderCardOverride }) {
  const name = override?.name || builder.full_name || builder.username || 'Builder'
  const roleLabel = override?.role || builderRoleLabel(builder)

  return (
    <Link to="/builders" className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-display font-bold">
        {builder.avatar_url ? (
          <img src={builder.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate group-hover:text-purple-light transition-colors">
          {name}
        </div>
        <div className="text-white/40 text-xs flex items-center gap-1.5 min-w-0">
          <span className="truncate">{roleLabel}</span>
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
