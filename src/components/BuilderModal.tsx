import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Globe, X } from 'lucide-react'
import type { PublicProfile } from '../types'
import { getRank } from '../lib/rank'
import { toAbsoluteUrl } from '../lib/socialLinks'
import CountryFlag from './CountryFlag'

// The full profile detail view for a builder — opened by clicking their
// BuilderCard on /builders, /community, and the homepage. Mirrors
// TeamMemberModal's chrome/pattern exactly (same portal-to-body reason:
// BuilderCard is always wrapped in a Reveal/motion.div, which becomes a
// CSS "containing block" for a `position: fixed` descendant, so without
// the portal this modal's backdrop would only cover that one grid cell).
//
// `name`/`roleLabel`/`project`/`bio`/`twitter` are passed in rather than
// read straight off `builder` so the two curated Explore Builders
// overrides (see FEATURED_BUILDER_OVERRIDES in featuredBuilders.ts) can
// supply their real, already-published team name/bio/X link here too —
// every other builder just gets their own real profile fields, nothing
// invented. `twitter` arrives already normalized to a full URL (see
// BuilderCard) — only `website` still needs that here.
export default function BuilderModal({
  builder,
  name,
  roleLabel,
  project,
  bio,
  twitter,
  onClose,
}: {
  builder: PublicProfile
  name: string
  roleLabel: string
  project?: string | null
  bio?: string | null
  twitter?: string | null
  onClose: () => void
}) {
  const rank = getRank(builder.xp)
  const website = builder.website ? toAbsoluteUrl(builder.website) : null

  const socials = [
    twitter && { key: 'x', href: twitter, label: 'X (Twitter)', node: <span className="text-sm font-bold">𝕏</span> },
    website && { key: 'website', href: website, label: 'Website', node: <Globe size={15} /> },
  ].filter((s): s is { key: string; href: string; label: string; node: JSX.Element } => !!s)

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-squircle border border-white/10 bg-panel p-7 relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`${name} — profile`}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-xl font-display font-bold mb-4">
            {builder.avatar_url ? (
              <img src={builder.avatar_url} alt={name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
          </div>
          <h3 className="font-display font-semibold text-xl">{name}</h3>
          <p className="text-purple-light text-sm font-medium mt-1">{roleLabel}</p>
          {project && <p className="text-white/50 text-sm mt-0.5">Building {project}</p>}

          {builder.country && (
            <span className="flex items-center gap-1.5 text-white/45 text-xs mt-3">
              <CountryFlag country={builder.country} size={12} />
              {builder.country}
            </span>
          )}

          <div className="flex items-center gap-2 mt-4">
            <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/60">{rank.emoji} {rank.name}</span>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-purple/30 bg-purple/10 text-purple-light">{builder.xp} XP</span>
          </div>

          {bio && (
            <div className="mt-5 text-left w-full">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">About</span>
              <p className="text-white/60 text-sm leading-relaxed mt-1.5">{bio}</p>
            </div>
          )}

          {socials.length > 0 && (
            <div className="w-full mt-6 pt-5 border-t border-white/10">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/35 block mb-3 text-left">Socials</span>
              <div className="flex flex-wrap justify-center gap-2">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${name} on ${s.label}`}
                    title={s.label}
                    className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-purple/40 transition-colors"
                  >
                    {s.node}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
