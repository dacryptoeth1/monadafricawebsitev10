import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { defaultSiteSettings, type SiteSettings } from '../types'

// Home, Bounties, and Community each independently fetched
// `site_settings` (id=1) on their own mount — so navigating
// Home -> Bounties -> Community re-issued the exact same read 3 times
// in one visit for data that changes maybe a few times a month. This
// module-level cache makes the first page to mount do the one real
// fetch; every page after it (for the rest of this browser session)
// reads the already-resolved value with no network round trip at all.
//
// Deliberately NOT a React Context: these pages don't share a common
// tree above them worth threading a provider through, and a bare
// module singleton + subscriber list is simpler for a single small,
// rarely-changing row. It resets on a full page reload, same as
// everything else in memory, and stays correct because nothing here
// bypasses RLS or changes what data any page is allowed to see.
let cache: SiteSettings | null = null
let inflight: Promise<void> | null = null
const subscribers = new Set<(s: SiteSettings) => void>()

function load(): Promise<void> {
  if (cache || inflight) return inflight ?? Promise.resolve()
  // Wrapped in Promise.resolve(): the Supabase query builder is
  // "thenable" (awaitable) but not a real Promise instance, so its
  // .then() return value doesn't satisfy Promise<void> on its own.
  inflight = Promise.resolve(
    supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        cache = data ? (data as SiteSettings) : defaultSiteSettings
        inflight = null
        subscribers.forEach((fn) => fn(cache!))
      }),
  )
  return inflight
}

/** Lets an admin save flow (AdminSettings/AdminHomepage) force the next
 * read — on this page or any other still-mounted page in this tab — to
 * reflect a just-saved change instead of serving the stale cached row. */
export function invalidateSiteSettingsCache() {
  cache = null
  inflight = null
}

export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(cache ?? defaultSiteSettings)

  useEffect(() => {
    if (cache) {
      setSettings(cache)
      return
    }
    subscribers.add(setSettings)
    load()
    return () => {
      subscribers.delete(setSettings)
    }
  }, [])

  return settings
}
