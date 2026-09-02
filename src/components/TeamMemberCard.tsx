import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Send } from 'lucide-react'
import type { TeamMember } from '../types'
import TeamMemberModal from './TeamMemberModal'

// Clean initials fallback (e.g. "Crypto Testeer" → "CT") — used until a
// member has a real profile photo uploaded via Admin → Team Management.
// Deliberately no stock photos anywhere in this app.
export function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// The whole card opens a full profile (see TeamMemberModal) on click —
// the social icons and "Contact for Partnerships" link below stay
// directly clickable themselves (stopPropagation), so clicking one of
// those still just opens that link instead of also popping the modal.
export default function TeamMemberCard({ member, highlight = false }: { member: TeamMember; highlight?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`View ${member.name}'s profile`}
        className={`rounded-squircle border p-7 h-full flex flex-col transition-all hover:-translate-y-1 cursor-pointer ${
          highlight ? 'border-gold/40 bg-gradient-to-br from-gold/10 to-transparent hover:border-gold/60' : 'border-white/10 bg-white/[0.02] hover:border-purple/40'
        }`}
      >
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-lg font-display font-bold">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              initialsFor(member.name)
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-lg truncate">{member.name}</h3>
            <p className="text-purple-light text-sm font-medium leading-snug">{member.primary_role}</p>
          </div>
        </div>

        {member.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {member.badges.map((b) => (
              <span key={b} className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/15 text-white/50">
                {b}
              </span>
            ))}
          </div>
        )}

        {member.bio && <p className="text-white/55 text-sm leading-relaxed flex-1 mb-5">{member.bio}</p>}

        {highlight && (member.telegram_url || member.x_url) && (
          <a
            href={member.telegram_url || member.x_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 px-5 py-3 mb-4 rounded-full text-sm font-semibold bg-gradient-to-br from-gold to-sunset-amber text-ink hover:-translate-y-0.5 transition-transform"
          >
            <Send size={14} /> Contact for Partnerships
          </a>
        )}

        <div className="flex gap-2 mt-auto">
          {member.x_url && (
            <a
              href={member.x_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`${member.name} on X`}
              title="X (Twitter)"
              className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-purple/40 transition-colors text-sm font-bold"
            >
              𝕏
            </a>
          )}
          {member.telegram_url && (
            <a
              href={member.telegram_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`${member.name} on Telegram`}
              title="Telegram"
              className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-purple/40 transition-colors"
            >
              <Send size={16} />
            </a>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && <TeamMemberModal member={member} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

// A compact single-line variant of the same clickable-card-> profile
// modal behavior — used wherever the full TeamMemberCard is too tall
// (e.g. the homepage's 3-column discovery grid). Same real data, same
// TeamMemberModal, same click-to-open interaction; only the resting
// presentation is a row instead of a padded card.
export function TeamMemberRow({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`View ${member.name}'s profile`}
        className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg cursor-pointer hover:bg-white/[0.03] transition-colors group"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-xs font-display font-bold">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt={member.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            initialsFor(member.name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-sm truncate group-hover:text-purple-light transition-colors">{member.name}</div>
          <div className="text-white/40 text-xs truncate">{member.primary_role}</div>
        </div>
      </div>

      <AnimatePresence>
        {open && <TeamMemberModal member={member} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
