import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Github, Globe, Linkedin, MessageCircle, Send, X } from 'lucide-react'
import type { TeamMember } from '../types'
import { initialsFor } from './TeamMemberCard'

// The full profile detail view for a team member — opened by clicking
// their TeamMemberCard (on /team and the homepage "Meet the builders"
// preview, wherever that card is used). Same modal chrome as
// EventRegistrationModal (backdrop + centered panel), so it matches
// the rest of the site's existing modal language rather than
// introducing a new pattern.
//
// Socials are data-driven, not hardcoded: only a field that's actually
// set on this member renders a link — nothing here is ever invented.
// team_members currently only has real x_url/telegram_url data; the
// linkedin/github/discord/website columns (migration 0047) exist so an
// admin can add a real one later without any component changes.
// Rendered via a portal straight onto document.body: TeamMemberCard is
// always wrapped in a Reveal (a framer-motion motion.div), which ends
// up applying an inline `transform` — that turns it into a CSS
// "containing block" for anything `position: fixed` underneath it, so
// without the portal this modal's fixed backdrop would only cover that
// one grid cell instead of the full viewport.
export default function TeamMemberModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const socials = [
    member.x_url && { key: 'x', href: member.x_url, label: 'X (Twitter)', node: <span className="text-sm font-bold">𝕏</span> },
    member.telegram_url && { key: 'telegram', href: member.telegram_url, label: 'Telegram', node: <Send size={15} /> },
    member.linkedin_url && { key: 'linkedin', href: member.linkedin_url, label: 'LinkedIn', node: <Linkedin size={15} /> },
    member.github_url && { key: 'github', href: member.github_url, label: 'GitHub', node: <Github size={15} /> },
    member.discord_url && { key: 'discord', href: member.discord_url, label: 'Discord', node: <MessageCircle size={15} /> },
    member.website_url && { key: 'website', href: member.website_url, label: 'Website', node: <Globe size={15} /> },
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
        aria-label={`${member.name} — profile`}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-xl font-display font-bold mb-4">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              initialsFor(member.name)
            )}
          </div>
          <h3 className="font-display font-semibold text-xl">{member.name}</h3>
          <p className="text-purple-light text-sm font-medium mt-1">{member.primary_role}</p>

          {member.badges.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-4">
              {member.badges.map((b) => (
                <span key={b} className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/15 text-white/50">
                  {b}
                </span>
              ))}
            </div>
          )}

          {member.bio && (
            <div className="mt-5 text-left w-full">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">About</span>
              <p className="text-white/60 text-sm leading-relaxed mt-1.5">{member.bio}</p>
            </div>
          )}

          {member.is_bd_lead && member.telegram_url && (
            <a
              href={member.telegram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-5 py-3 mt-6 rounded-full text-sm font-semibold bg-gradient-to-br from-gold to-sunset-amber text-ink hover:-translate-y-0.5 transition-transform"
            >
              <Send size={14} /> Contact for Partnerships
            </a>
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
                    aria-label={`${member.name} on ${s.label}`}
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
