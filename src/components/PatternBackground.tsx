// Tasteful, minimal African-inspired background layers — pure decorative
// SVG, used at low opacity throughout the site.

export function KentePattern({ className = '' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="kente" width="64" height="64" patternUnits="userSpaceOnUse">
          <path d="M0 32 L32 0 L64 32 L32 64 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M32 8 L56 32 L32 56 L8 32 Z" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="32" cy="32" r="3" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kente)" />
    </svg>
  )
}

export function ContourLines({ className = '' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 1200 400" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M0 ${60 + i * 55} C 200 ${20 + i * 55}, 350 ${100 + i * 55}, 600 ${55 + i * 55} S 1000 ${10 + i * 55}, 1200 ${60 + i * 55}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity={0.5 - i * 0.06}
        />
      ))}
    </svg>
  )
}
