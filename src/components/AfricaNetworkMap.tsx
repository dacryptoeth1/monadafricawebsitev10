import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { MAP_HEIGHT, MAP_WIDTH, project } from '../lib/africaGeo'

export interface MapNode {
  name: string
  x: number
  y: number
  /** Real magnitude (e.g. builder count) — scales the node's size. Omit for a plain marker. */
  value?: number
  /** Real, already-formatted detail line shown on hover/tap (e.g. "12 builders") — never invented. */
  detail?: string
}

// The map itself is now the real Monad Africa network-map brand asset —
// the same artwork the homepage hero uses, and one of the existing
// project assets the marketing review pointed at. It replaces the
// hand-drawn continent silhouette this component used to draw, which is
// what made the "Where the community is building from" panel read as
// "an empty outline with two dots": a crude blob plus a couple of
// markers, with nothing branded about it.
//
// Because the artwork is a real (essentially plate-carrée) rendering of
// the continent, every node can be placed by projecting its actual
// latitude/longitude onto it (see lib/africaGeo.ts) instead of being
// eyeballed against a silhouette — so a country marker lands on that
// country.
const BRAND_MAP = '/brand/africa-network-map-purple.webp'

// The default, purely decorative node set used wherever this component
// is dropped in as ambient background art (the Builders page watermark,
// section watermarks, ...). Passing a real `nodes` prop swaps this out
// for actual data, as /explore and the homepage do with per-country
// builder counts.
const DECORATIVE_CITIES: [string, number, number][] = [
  ['Cairo', 30.04, 31.24],
  ['Accra', 5.6, -0.19],
  ['Lagos', 6.52, 3.38],
  ['Douala', 4.05, 9.77],
  ['Kampala', 0.35, 32.58],
  ['Nairobi', -1.29, 36.82],
  ['Kigali', -1.94, 30.06],
  ['Cape Town', -33.92, 18.42],
]
const DECORATIVE_NODES: MapNode[] = DECORATIVE_CITIES.map(([name, lat, lon]) => ({ name, ...project(lat, lon) }))

const DECORATIVE_LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 7], [1, 4],
]

// The pulsing node rings used to be plain SVG SMIL <animate> elements with
// repeatCount="indefinite" — that runs forever on the compositor even when
// this section is scrolled out of view or the tab is backgrounded, and
// SMIL animations aren't touched by the app-wide CSS `prefers-reduced-motion`
// rule (that rule only lowers *CSS* animation/transition durations). Both
// are exactly the "constantly animated background" cost this component
// shouldn't have. Now the rings only mount (and thus only animate) while
// the map is actually on screen, and don't mount at all for users who asked
// for reduced motion.
// Wrapped in memo: its parents already gate most unnecessary re-renders
// (e.g. ExploreAfricaSection is memoized and only passes a useMemo'd
// nodes array), but this component itself wasn't memoized before —
// cheap, correct, zero-risk insurance against re-rendering an SVG with
// up to 12 nodes/animations whenever an ancestor re-renders for an
// unrelated reason.
const AfricaNetworkMap = memo(function AfricaNetworkMap({
  className = '',
  nodes,
  links,
  interactive = false,
  showLabels = false,
}: {
  className?: string
  /** Real data nodes. Omit to get the default decorative set (unchanged behavior). */
  nodes?: MapNode[]
  /** Explicit connections as [fromIndex, toIndex] pairs — only drawn when given; real nodes don't get invented connections by default. */
  links?: [number, number][]
  /** Enables the hover/tap info label — only meaningful when `nodes` carries real data. */
  interactive?: boolean
  /**
   * Draws each real node's country name and value permanently beside it,
   * so the map communicates its data at a glance — and on touch, where
   * there is no hover at all — rather than only on interaction.
   */
  showLabels?: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [animate, setAnimate] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  // How many CSS pixels one viewBox unit currently occupies. Label text
  // lives inside the SVG, so it scales with the map — at 1440px the map
  // renders near full size and 15 viewBox units is a comfortable ~13px,
  // but inside a phone card the same map renders at ~0.4x and that same
  // label collapses to ~6px, which is exactly where the map has to be
  // MOST readable (touch devices have no hover to fall back on).
  // Measuring the real scale lets label sizes be specified in finished
  // pixels and stay constant at every width.
  const [scale, setScale] = useState(1)

  const isRealData = !!nodes
  const activeNodes = nodes ?? DECORATIVE_NODES
  const activeLinks = links ?? (isRealData ? [] : DECORATIVE_LINKS)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setAnimate(entry.isIntersecting), { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!showLabels) return
    const el = ref.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      // preserveAspectRatio="meet" letterboxes, so the effective scale is
      // whichever axis is the binding constraint.
      setScale(Math.min(rect.width / MAP_WIDTH, rect.height / MAP_HEIGHT))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [showLabels])

  // Target sizes in finished CSS pixels, converted back into viewBox
  // units. Clamped so an extremely small render can't blow the label up
  // to the width of the continent.
  const px = (target: number) => Math.min(target / Math.max(scale, 0.12), target * 3.2)
  const nameSize = px(12.5)
  const detailSize = px(10.5)
  const labelStroke = px(2.6)

  const activeNode = active !== null ? activeNodes[active] : null
  const maxValue = isRealData ? Math.max(1, ...activeNodes.map((n) => n.value ?? 0)) : 0

  // Which side of its marker each label sits on. Countries in the data
  // cluster (Ghana and Nigeria are neighbours, and today they are the
  // only two nodes), so a fixed "labels go right until the midpoint"
  // rule puts one label straight through the next country's marker.
  // Instead each label is pushed AWAY from its nearest neighbour, and
  // only falls back to the midpoint rule when it has no close one —
  // with a clamp so a label near an edge still points inward.
  const labelSides = useMemo(() => {
    return activeNodes.map((n, i) => {
      let nearest = -1
      let nearestDist = Infinity
      activeNodes.forEach((m, j) => {
        if (i === j) return
        const d = (n.x - m.x) ** 2 + (n.y - m.y) ** 2
        if (d < nearestDist) { nearestDist = d; nearest = j }
      })
      const midpointRule = n.x > MAP_WIDTH / 2
      if (nearest < 0 || nearestDist > 150 ** 2) return midpointRule
      // `true` means "label to the left of the marker".
      const away = activeNodes[nearest].x > n.x
      if (away && n.x < 130) return false // too close to the west edge
      if (!away && n.x > MAP_WIDTH - 130) return true // too close to the east edge
      return away
    })
  }, [activeNodes])

  // A faint mesh joining each real node to its nearest neighbour. Purely
  // presentational — drawn *from* the real nodes, asserting no
  // relationship between the countries it touches, which is why it stays
  // low-contrast and unlabeled. With one or two countries in the data it
  // is empty or a single hairline, so it can never make the map look
  // busier than the data behind it.
  const meshLinks = useMemo(() => {
    if (!isRealData || activeNodes.length < 2) return [] as [number, number][]
    const seen = new Set<string>()
    const out: [number, number][] = []
    activeNodes.forEach((n, i) => {
      let best = -1
      let bestDist = Infinity
      activeNodes.forEach((m, j) => {
        if (i === j) return
        const d = (n.x - m.x) ** 2 + (n.y - m.y) ** 2
        if (d < bestDist) { bestDist = d; best = j }
      })
      if (best < 0) return
      const key = i < best ? `${i}-${best}` : `${best}-${i}`
      if (seen.has(key)) return
      seen.add(key)
      out.push([i, best])
    })
    return out
  }, [isRealData, activeNodes])

  return (
    <svg
      ref={ref}
      className={className}
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      // Without this, an SVG given only a max-height still reserves its
      // full intrinsic width on some engines, which is what let the map
      // push its card sideways at 360–390px. Letter-boxing inside
      // whatever box the parent gives it keeps it inside the card at
      // every width.
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={!interactive}
    >
      <defs>
        <linearGradient id="linkGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8B75D" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#8C79FF" stopOpacity="0.7" />
        </linearGradient>
        {/* Ambient glow behind the artwork — one radial gradient rather
            than a CSS blur filter, so it costs nothing to paint on
            mobile GPUs. */}
        <radialGradient id="mapGlow" cx="0.48" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#6E54FF" stopOpacity="0.34" />
          <stop offset="70%" stopColor="#6E54FF" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#6E54FF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={MAP_WIDTH * 0.47} cy={MAP_HEIGHT * 0.5} rx={MAP_WIDTH * 0.42} ry={MAP_HEIGHT * 0.52} fill="url(#mapGlow)" />

      <image
        href={BRAND_MAP}
        x="0"
        y="0"
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        preserveAspectRatio="xMidYMid meet"
        // Decorative: the <svg> element itself carries the accessible
        // role and labels for anything interactive.
        aria-hidden="true"
      />

      {meshLinks.map(([a, b], i) => (
        <line
          key={`mesh-${i}`}
          x1={activeNodes[a].x}
          y1={activeNodes[a].y}
          x2={activeNodes[b].x}
          y2={activeNodes[b].y}
          stroke="#A99AFF"
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.35"
        />
      ))}

      {activeLinks.map(([a, b], i) => (
        <line key={i} x1={activeNodes[a].x} y1={activeNodes[a].y} x2={activeNodes[b].x} y2={activeNodes[b].y} stroke="url(#linkGradient)" strokeWidth="1" strokeDasharray="4 5" opacity="0.55" />
      ))}

      {activeNodes.map((n, i) => {
        // Real nodes scale 5–11px by their value; decorative nodes stay
        // a fixed 4.5px.
        const r = isRealData ? 5 + ((n.value ?? 0) / maxValue) * 6 : 4.5
        const flip = labelSides[i]
        return (
          <g
            key={n.name}
            transform={`translate(${n.x},${n.y})`}
            {...(interactive
              ? {
                  onMouseEnter: () => setActive(i),
                  onMouseLeave: () => setActive((cur) => (cur === i ? null : cur)),
                  onClick: () => setActive((cur) => (cur === i ? null : i)),
                  onFocus: () => setActive(i),
                  tabIndex: 0,
                  role: 'button',
                  'aria-label': `${n.name}${n.detail ? ` — ${n.detail}` : ''}`,
                  style: { cursor: 'pointer' },
                }
              : {})}
          >
            {/* CSS transform/opacity, not SMIL — but a CSS transform on an
                SVG shape still isn't guaranteed the same reliable
                compositor-only fast path an equivalent HTML element gets
                on every mobile engine (notably older/lower-end mobile
                Safari and Chrome). With a real data set carrying up to
                12 nodes, that's up to 12 simultaneous infinite animations
                competing with scroll on the same page — on mobile
                specifically. `md:animate-network-pulse` means the
                animation class is never applied below the md breakpoint
                at all: mobile gets the identical static ring (same
                stroke/opacity/radius, just not animating) instead, while
                tablet/desktop keep the exact same pulsing effect as
                before. Same IntersectionObserver + reduced-motion
                mount/unmount gating either way. */}
            <circle
              r={r + 1.5}
              fill="none"
              stroke="#A99AFF"
              strokeWidth="1"
              opacity="0.5"
              className={animate ? 'origin-center md:animate-network-pulse motion-reduce:animate-none' : undefined}
              style={animate ? { transformBox: 'fill-box', animationDelay: `${i * 0.3}s` } : undefined}
            />
            {/* A dark disc under every data marker keeps it legible over
                the brighter parts of the artwork. */}
            {isRealData && <circle r={r + 2.5} fill="#07050A" opacity="0.6" />}
            <circle r={r} fill={i % 2 === 0 ? '#E8B75D' : '#A99AFF'} className={interactive ? 'transition-[r] duration-200' : undefined} />
            {interactive && active === i && (
              <circle r={r + 3} fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
            )}

            {showLabels && isRealData && (
              <g transform={`translate(${flip ? -(r + 7) : r + 7},0)`} pointerEvents="none">
                <text
                  x="0"
                  y={-detailSize * 0.15}
                  textAnchor={flip ? 'end' : 'start'}
                  className="font-display"
                  fill="#ffffff"
                  fillOpacity="0.95"
                  fontSize={nameSize}
                  fontWeight="600"
                  // A dark outline painted *under* the glyphs (paint-order:
                  // stroke) keeps labels readable over both the dark
                  // background and the artwork's bright coastline, without
                  // needing an opaque plate behind them.
                  style={{ paintOrder: 'stroke', stroke: '#07050A', strokeWidth: labelStroke, strokeLinejoin: 'round' }}
                >
                  {n.name}
                </text>
                {n.detail && (
                  <text
                    x="0"
                    y={nameSize}
                    textAnchor={flip ? 'end' : 'start'}
                    fill="#A99AFF"
                    fontSize={detailSize}
                    style={{ paintOrder: 'stroke', stroke: '#07050A', strokeWidth: labelStroke, strokeLinejoin: 'round' }}
                  >
                    {n.detail}
                  </text>
                )}
              </g>
            )}
          </g>
        )
      })}

      {interactive && activeNode && (
        <foreignObject
          // Clamped to the viewBox so the panel can never be drawn
          // outside the map (and therefore clipped away) for a node near
          // an edge.
          x={Math.max(4, Math.min(MAP_WIDTH - 184, active !== null && labelSides[active] ? activeNode.x - 184 : activeNode.x + 14))}
          y={Math.max(0, Math.min(MAP_HEIGHT - 56, activeNode.y - 30))}
          width="180"
          height="56"
          pointerEvents="none"
        >
          <div className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-ink/95 border border-purple/40 shadow-lg w-fit max-w-full">
            <span className="text-white text-xs font-display font-semibold whitespace-nowrap">{activeNode.name}</span>
            {activeNode.detail && <span className="text-purple-light text-[11px] whitespace-nowrap">{activeNode.detail}</span>}
          </div>
        </foreignObject>
      )}
    </svg>
  )
})

export default AfricaNetworkMap
