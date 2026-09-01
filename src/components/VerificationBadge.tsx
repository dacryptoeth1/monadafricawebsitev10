import { BadgeCheck, CheckCircle2, Clock, Handshake, ShieldOff, Users } from 'lucide-react'
import type { Bounty, PublicBadgeLabel } from '../types'
import { publicBadgeLabel } from '../types'

const STYLES: Record<PublicBadgeLabel, { className: string; Icon: typeof BadgeCheck }> = {
  'Verified by Monad Africa': { className: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10', Icon: BadgeCheck },
  'Partner Bounty': { className: 'text-purple-light border-purple/30 bg-purple/10', Icon: Handshake },
  'Community Bounty': { className: 'text-white/60 border-white/20 bg-white/5', Icon: Users },
  'Completed': { className: 'text-gold border-gold/30 bg-gold/10', Icon: CheckCircle2 },
  'Submissions Closed': { className: 'text-white/50 border-white/20 bg-white/5', Icon: Clock },
  'Expired': { className: 'text-rose-300/80 border-rose-300/25 bg-rose-300/10', Icon: ShieldOff },
}

// The badge shown on every public bounty (card + detail context) — see
// migration 0037 and src/types.ts's publicBadgeLabel(). Reused across
// BountyCard.tsx and the Bounties.tsx page header.
export default function VerificationBadge({
  bounty,
  size = 'sm',
}: {
  bounty: Pick<Bounty, 'verification_badge' | 'is_closed' | 'completion_status'>
  size?: 'sm' | 'md'
}) {
  const label = publicBadgeLabel(bounty)
  const { className, Icon } = STYLES[label]
  const sizing = size === 'md' ? 'text-xs px-3 py-1.5 gap-1.5' : 'text-[10px] px-2.5 py-1 gap-1'

  return (
    <span className={`inline-flex items-center font-mono uppercase rounded-full border font-semibold ${sizing} ${className}`}>
      <Icon size={size === 'md' ? 13 : 11} />
      {label}
    </span>
  )
}

// Shared one-liner explaining what the badge means — shown once,
// prominently, on the Bounties.tsx page header.
export function VerificationDisclaimer({ className = '' }: { className?: string }) {
  return (
    <p className={`text-white/40 text-xs leading-relaxed ${className}`}>
      Only bounties carrying the <span className="text-emerald-300/80 font-medium">Verified by Monad Africa</span> badge
      have passed the Monad Africa review process. Partner and Community bounties are disclosed as such — always do
      your own research before participating.
    </p>
  )
}
