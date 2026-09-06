// The Monad Africa brand mark, used throughout the site (nav, hero,
// footer, login/signup, loading states, dashboards). This renders the
// real artwork now — previously a plain purple-square "M" placeholder
// until the actual asset was supplied.
//
// `loading="lazy"` stays the default (every existing caller keeps its
// current behavior unchanged) — it's correct for the footer's copy,
// but actively counterproductive for a mark that's always inside the
// initial viewport (the hero's own logo above the title): the browser
// can't start fetching a lazy image until it's confirmed near-viewport,
// which costs time on exactly the images that should start loading
// immediately. `priority` opts a specific always-above-the-fold call
// site out of that, in place — no default changed for anyone else.
export default function MonadMark({ size = 28, className = '', priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <img
      src="/brand/monad-africa-mark.jpg"
      alt="Monad Africa"
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      // Lowercase, not the camelCase `fetchPriority` — this React
      // version (18.3) doesn't recognize that prop name and silently
      // drops it (with a dev-console warning), which means the actual
      // browser hint never lands. The lowercase spelling is passed
      // through untouched as a real DOM attribute either way.
      {...(priority ? { fetchpriority: 'high' as const } : {})}
      className={`inline-block rounded-lg object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
