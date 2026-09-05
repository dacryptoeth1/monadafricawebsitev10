import { flagSrcFor, countryCodeFor } from '../lib/countryFlag'

// The single, cross-platform way to render a country flag anywhere on
// the site. Replaces the emoji flags that only rendered on mobile:
// Windows has no country-flag emoji font, so desktop Chrome/Edge showed
// bare "NG"-style letter boxes while Android/iOS showed the flag. These
// are real SVG assets served from the site's own /public/flags folder
// (vendored once, no CDN and no runtime network dependency beyond the
// site itself), so Desktop Chrome, every other desktop browser, and
// every mobile browser all draw the identical image.
//
// A country the data has no asset for renders nothing at all rather
// than a wrong or placeholder flag — same rule the old emoji map
// followed. The `onError` fallback covers the (unexpected) case of a
// mapped asset failing to load: the element hides itself instead of
// leaving a broken-image icon in the middle of a card.
export default function CountryFlag({
  country,
  size = 14,
  className = '',
}: {
  /** Plain-text country name exactly as stored in profiles.country. */
  country: string | null | undefined
  /** Rendered flag height in px; width follows the standard 4:3 ratio. */
  size?: number
  className?: string
}) {
  const src = flagSrcFor(country)
  if (!src) return null

  return (
    <img
      src={src}
      alt=""
      // Decorative: every call site already renders the country name as
      // real text next to it, so announcing the flag too would just
      // duplicate it for a screen reader.
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={Math.round((size * 4) / 3)}
      height={size}
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
      // The thin ring keeps predominantly-white flags (Nigeria's white
      // centre band, Egypt's white stripe) from bleeding into the dark
      // card behind them; rounded + object-cover matches the rest of
      // the site's imagery treatment.
      className={`inline-block shrink-0 rounded-[2px] object-cover ring-1 ring-white/15 align-[-0.15em] ${className}`}
      style={{ width: Math.round((size * 4) / 3), height: size }}
      data-country-code={countryCodeFor(country) ?? undefined}
    />
  )
}
