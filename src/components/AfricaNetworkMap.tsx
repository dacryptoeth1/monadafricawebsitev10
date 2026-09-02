import { useEffect, useRef, useState } from 'react'

export interface MapNode {
  name: string
  x: number
  y: number
  /** Real magnitude (e.g. builder count) — scales the node's size. Omit for a plain marker. */
  value?: number
  /** Real, already-formatted detail line shown on hover/tap (e.g. "12 builders") — never invented. */
  detail?: string
}

// The default, purely decorative node set used everywhere this
// component is dropped in as ambient background art (Hero, the Team
// section watermark, the Ecosystem section watermark, ...) — unchanged
// from before. Passing a real `nodes` prop (see MapNode below) swaps
// this out for actual data instead, currently used on /explore's
// "Explore Africa" section with real per-country builder counts.
const DECORATIVE_NODES: MapNode[] = [
  { name: 'Cairo', x: 345, y: 105 },
  { name: 'Accra', x: 148, y: 318 },
  { name: 'Lagos', x: 215, y: 345 },
  { name: 'Douala', x: 275, y: 368 },
  { name: 'Kampala', x: 378, y: 342 },
  { name: 'Nairobi', x: 408, y: 362 },
  { name: 'Kigali', x: 372, y: 388 },
  { name: 'Cape Town', x: 295, y: 565 },
]

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
export default function AfricaNetworkMap({
  className = '',
  nodes,
  links,
  interactive = false,
}: {
  className?: string
  /** Real data nodes. Omit to get the default decorative set (unchanged behavior). */
  nodes?: MapNode[]
  /** Explicit connections as [fromIndex, toIndex] pairs — only drawn when given; real nodes don't get invented connections by default. */
  links?: [number, number][]
  /** Enables the hover/tap info label — only meaningful when `nodes` carries real data. */
  interactive?: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [animate, setAnimate] = useState(false)
  const [active, setActive] = useState<number | null>(null)

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

  const activeNode = active !== null ? activeNodes[active] : null
  // Flip the label to the node's left once it's past the map's
  // horizontal midpoint, so it doesn't run off the right edge.
  const labelFlip = activeNode ? activeNode.x > 300 : false
  const maxValue = isRealData ? Math.max(1, ...activeNodes.map((n) => n.value ?? 0)) : 0

  return (
    <svg ref={ref} className={className} viewBox="0 0 600 620" xmlns="http://www.w3.org/2000/svg" aria-hidden={!interactive}>
      <defs>
        <linearGradient id="continentStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFB347" />
          <stop offset="55%" stopColor="#A99AFF" />
          <stop offset="100%" stopColor="#6E54FF" />
        </linearGradient>
        <linearGradient id="linkGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8B75D" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#8C79FF" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      <path
        d="M300,20 C250,14 182,42 150,92 C112,150 62,178 50,232 C40,280 72,312 92,360 C60,400 42,432 62,472 C82,512 132,520 152,562 C172,602 232,612 262,600 C292,588 300,558 322,520 C342,482 382,472 402,432 C432,382 462,340 472,292 C482,242 522,222 542,180 C562,138 542,98 500,80 C460,62 430,92 400,70 C372,50 350,26 300,20 Z"
        fill="rgba(110,84,255,0.05)"
        stroke="url(#continentStroke)"
        strokeWidth="1.4"
      />

      {activeLinks.map(([a, b], i) => (
        <line key={i} x1={activeNodes[a].x} y1={activeNodes[a].y} x2={activeNodes[b].x} y2={activeNodes[b].y} stroke="url(#linkGradient)" strokeWidth="1" strokeDasharray="4 5" opacity="0.55" />
      ))}

      {activeNodes.map((n, i) => {
        // Real nodes scale 4–9px by their value; decorative nodes stay
        // the original fixed 4.5px.
        const r = isRealData ? 4 + ((n.value ?? 0) / maxValue) * 5 : 4.5
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
            {/* CSS transform/opacity animation instead of SMIL <animate>
                on `r` — a per-frame SVG geometry attribute change forces
                layout+paint every frame; scaling via CSS transform is
                compositor-only (GPU), the standard cheap way to do a
                "pulse ring" and meaningfully lighter on mobile when
                several nodes are animating at once. Same stagger (i*0.3s),
                same mount/unmount gating (IntersectionObserver + reduced-
                motion, both already handled by `animate` above) — this
                only changes *how* the animation runs, not when. */}
            <circle
              r={r + 1.5}
              fill="none"
              stroke="#A99AFF"
              strokeWidth="1"
              opacity="0.5"
              className={animate ? 'origin-center animate-network-pulse motion-reduce:animate-none' : undefined}
              style={animate ? { transformBox: 'fill-box', animationDelay: `${i * 0.3}s` } : undefined}
            />
            <circle r={r} fill={i % 2 === 0 ? '#E8B75D' : '#A99AFF'} className={interactive ? 'transition-[r] duration-200' : undefined} />
            {interactive && active === i && (
              <circle r={r + 3} fill="none" stroke="#fff" strokeWidth="1.5" opacity="0.9" />
            )}
          </g>
        )
      })}

      {interactive && activeNode && (
        <foreignObject
          x={labelFlip ? activeNode.x - 194 : activeNode.x + 14}
          y={Math.max(0, activeNode.y - 34)}
          width="180"
          height="60"
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
}
