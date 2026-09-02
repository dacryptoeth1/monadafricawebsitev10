import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `server` only affects `vite`/`vite dev` (and `preview` below) — it
  // has no effect on `vite build`'s output, so this doesn't touch the
  // production deployment. host: true binds the dev server to every
  // network interface (0.0.0.0), not just localhost, so it's reachable
  // from another device (e.g. a phone) on the same LAN via the
  // "Network:" URL Vite prints on startup.
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split large, infrequently-changing vendor libraries out of the
        // main entry chunk (previously ~529KB/157KB gzip, downloaded on
        // every single page load — including the homepage — regardless
        // of route). This doesn't shrink total bytes shipped, but it
        // means: (1) these vendor chunks are cached by the browser
        // independently of app code, so a future app-only deploy doesn't
        // invalidate them, and (2) the browser can fetch them in
        // parallel with route chunks instead of one monolithic blocking
        // chunk — both matter more on mobile's slower/higher-latency
        // connections than on desktop.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react'],
          // country-state-city bundles its full country/state dataset
          // (~400KB+ raw) and is imported directly by three separate
          // places (CountrySelect.tsx, RegionSelect.tsx, and Profile.tsx
          // — the latter imports `Country` on its own to resolve a
          // saved country name back to an ISO code). Without an explicit
          // shared chunk, Rollup was duplicating the dataset into
          // Profile's own chunk (518KB) instead of reusing the same
          // chunk CountrySelect/Signup/EventRegistrationModal already
          // load — pinning it here guarantees one shared, cacheable copy.
          'vendor-country-data': ['country-state-city'],
        },
      },
    },
  },
})
