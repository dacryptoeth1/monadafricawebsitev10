import { Send } from 'lucide-react'
import type { TeamMember } from '../types'

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

export default function TeamMemberCard({ member, highlight = false }: { member: TeamMember; highlight?: boolean }) {
  return (
    <div
      className={`rounded-squircle border p-7 h-full flex flex-col transition-all hover:-translate-y-1 ${
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
            aria-label={`${member.name} on Telegram`}
            title="Telegram"
            className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 hover:border-purple/40 transition-colors"
          >
            <Send size={16} />
          </a>
        )}
      </div>
    </div>
  )
}
