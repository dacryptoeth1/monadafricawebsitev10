// The actual official Monad logo (not our own Monad Africa mark) — used
// specifically where we want to signal "built on / for Monad", per the
// navbar and footer requirements. Small and subtle by design so it
// reads as a partner badge, not a second competing brand mark.
export default function MonadOfficialBadge({ size = 18, className = '', muted = false, title }: { size?: number; className?: string; muted?: boolean; title?: string }) {
  return (
    <img
      src="/brand/monad-logo-white.png"
      alt="Monad"
      title={title}
      width={size}
      height={size}
      loading="lazy"
      className={`inline-block shrink-0 ${muted ? 'opacity-50 hover:opacity-90 transition-opacity' : ''} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
