import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// React Router doesn't reset scroll position on navigation the way a
// full page load does, so clicking a nav link (e.g. "Team") while
// scrolled down elsewhere in the app can land on the new page mid-way
// down instead of at its top. Hash links (e.g. /team#business-development)
// are left alone — the target page owns scrolling to its own anchor.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname, hash])

  return null
}
