import { useEffect, useRef, useState } from 'react'

const NODES = [
  { name: 'Cairo', x: 345, y: 105 },
  { name: 'Accra', x: 148, y: 318 },
  { name: 'Lagos', x: 215, y: 345 },
  { name: 'Douala', x: 275, y: 368 },
  { name: 'Kampala', x: 378, y: 342 },
  { name: 'Nairobi', x: 408, y: 362 },
  { name: 'Kigali', x: 372, y: 388 },
  { name: 'Cape Town', x: 295, y: 565 },
]

const LINKS: [number, number][] = [
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
export default function AfricaNetworkMap({ className = '' }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setAnimate(entry.isIntersecting), { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <svg ref={ref} className={className} viewBox="0 0 600 620" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

      {LINKS.map(([a, b], i) => (
        <line key={i} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="url(#linkGradient)" strokeWidth="1" strokeDasharray="4 5" opacity="0.55" />
      ))}

      {NODES.map((n, i) => (
        <g key={n.name} transform={`translate(${n.x},${n.y})`}>
          <circle r="10" fill="none" stroke="#A99AFF" strokeWidth="1" opacity="0.5">
            {animate && <animate attributeName="r" values="6;20" dur="2.6s" begin={`${i * 0.3}s`} repeatCount="indefinite" />}
            {animate && <animate attributeName="opacity" values="0.6;0" dur="2.6s" begin={`${i * 0.3}s`} repeatCount="indefinite" />}
          </circle>
          <circle r="4.5" fill={i % 2 === 0 ? '#E8B75D' : '#A99AFF'} />
        </g>
      ))}
    </svg>
  )
}
