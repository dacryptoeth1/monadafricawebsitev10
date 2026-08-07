// The Monad Africa brand mark, used throughout the site (nav, hero,
// footer, login/signup, loading states, dashboards). This renders the
// real artwork now — previously a plain purple-square "M" placeholder
// until the actual asset was supplied.
export default function MonadMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/monad-africa-mark.jpg"
      alt="Monad Africa"
      width={size}
      height={size}
      loading="lazy"
      className={`inline-block rounded-lg object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
