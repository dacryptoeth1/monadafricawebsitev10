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
    },
  },
  plugins: [],
}
