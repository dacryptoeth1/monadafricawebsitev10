/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#07050A',
        panel: '#0F0B16',
        purple: {
          DEFAULT: '#6E54FF',
          light: '#A99AFF',
          glow: '#8C79FF',
        },
        lavender: '#C9C3F5',
        gold: {
          DEFAULT: '#E8B75D',
          soft: '#F2CE8C',
        },
        sunset: {
          coral: '#FF7A59',
          amber: '#FFB347',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        squircle: '28px',
      },
      backgroundImage: {
        sunset: 'linear-gradient(120deg, #FF7A59 0%, #E8B75D 45%, #6E54FF 100%)',
      },
      // Subtle "live status" glow for the dot beside "Welcome to Monad
      // Africa" in the hero — opacity + glow radius breathe gently
      // between the dot's normal resting state and a dimmer one, then
      // back. Paired with `motion-reduce:animate-none` at the call site
      // so prefers-reduced-motion users get the static dot, not this.
      keyframes: {
        'monad-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 10px #8C79FF' },
          '50%': { opacity: '0.55', boxShadow: '0 0 4px #8C79FF' },
        },
        // AfricaNetworkMap's per-node pulsing ring — transform+opacity
        // only (compositor-friendly), replacing a per-frame SVG `r`
        // attribute animation. transform-box:fill-box (set inline at
        // the call site) makes `scale` originate from the circle's own
        // center rather than the SVG viewport's corner.
        'network-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        // The node markers themselves "breathing" — a gentle, real
        // ecosystem-activity feel (per the marketing brief) rather than
        // the ring's expanding ripple above. Opacity+transform+a subtle
        // drop-shadow glow — cheap enough to run on every breakpoint
        // including mobile (a handful of small circles, not the whole
        // map), unlike the ripple ring (md+ only, see AfricaNetworkMap).
        'node-blink': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(0.9)', filter: 'drop-shadow(0 0 1px rgba(169,154,255,0.35))' },
          '50%': { opacity: '1', transform: 'scale(1.1)', filter: 'drop-shadow(0 0 6px rgba(169,154,255,0.85))' },
        },
      },
      animation: {
        'monad-pulse': 'monad-pulse 2.4s ease-in-out infinite',
        'network-pulse': 'network-pulse 2.6s ease-out infinite',
        'node-blink': 'node-blink 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
