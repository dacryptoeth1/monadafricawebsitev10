import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CalendarDays, ExternalLink, Globe2, Radio, Search, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { EcosystemActivity, EventListing } from '../types'
import { freshnessLabel, pickFeaturedMoment, ACTIVITY_STATUS_STYLES, PULSE_CATEGORY_LABELS } from '../lib/ecosystemActivity'
import { positionFor } from '../lib/africaGeo'
import EventCard from '../components/EventCard'
import EventRegistrationModal from '../components/EventRegistrationModal'
import EmptyState from '../components/EmptyState'
import Reveal from '../components/Reveal'
import AfricaNetworkMap, { type MapNode } from '../components/AfricaNetworkMap'

// Monad Ecosystem Pulse — deliberately NOT a calendar. Two independent,
// real data sources feed this page:
//   1. ecosystem_activity (migrations 0043/0045/0046) — "what's
//      happening across Monad right now": live-synced stats (currently
//      Monad TVL, refreshed by api/sync-ecosystem-tvl.ts on a
//      schedule), plus curated global + African ecosystem intelligence,
//      each with a real source and an honest freshness label. See
//      lib/ecosystemActivity.ts.
//   2. events / event_registrations — unchanged from before: Monad
//      Africa's own registerable meetups/workshops, with the existing
//      invite-code + check-in flow untouched.
const PULSE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'recent', label: 'Recent' },
  { key: 'builder', label: 'Builders' },
  { key: 'ecosystem', label: 'Ecosystem' },
  { key: 'community', label: 'Community' },
] as const
type PulseFilter = (typeof PULSE_FILTERS)[number]['key']

export default function Events() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { openEventId?: string } | null

  const [activity, setActivity] = useState<EcosystemActivity[] | null>(null)
  const [filter, setFilter] = useState<PulseFilter>('all')
  const [search, setSearch] = useState('')
  const [countries, setCountries] = useState<{ name: string; count: number }[] | null>(null)

  const [events, setEvents] = useState<EventListing[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<EventListing | null>(null)

  useEffect(() => {
    supabase
      .from('ecosystem_activity')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(24)
      .then(({ data }) => setActivity((data as EcosystemActivity[]) ?? []))

    // Real per-country builder counts, same source as /explore's Africa
    // map — used below to plot real Monad Africa presence, never a
    // scattered/invented node.
    supabase
      .from('leaderboard_public')
      .select('country')
      .not('country', 'is', null)
      .limit(300)
      .then(({ data }) => {
        const c = new Map<string, number>()
        for (const row of (data as { country: string | null }[]) ?? []) {
          if (!row.country) continue
          c.set(row.country, (c.get(row.country) ?? 0) + 1)
        }
        setCountries(Array.from(c, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12))
      })
  }, [])

  // Live-synced statistics get their own compact metrics row, not mixed
  // into the "Happening Now" feed or eligible to be the Featured
  // Moment — a raw number isn't a "moment". Architecture supports more
  // than one live metric; today there's genuinely just one (Monad TVL).
  const liveStats = useMemo(() => (activity ?? []).filter((a) => a.data_freshness === 'live' && a.statistic_value), [activity])
  const narrativeItems = useMemo(() => (activity ?? []).filter((a) => !liveStats.includes(a)), [activity, liveStats])
  const featured = useMemo(() => pickFeaturedMoment(narrativeItems), [narrativeItems])

  const heroFreshness = useMemo(() => {
    const rows = activity ?? []
    if (rows.length === 0) return null
    const liveFresh = rows.find(
      (a) => a.data_freshness === 'live' && a.last_synced_at && Date.now() - new Date(a.last_synced_at).getTime() < 24 * 60 * 60 * 1000,
    )
    const source = liveFresh ?? [...rows].sort((a, b) => {
      const at = new Date(a.last_synced_at ?? a.published_at).getTime()
      const bt = new Date(b.last_synced_at ?? b.published_at).getTime()
      return bt - at
    })[0]
    return { isLive: !!liveFresh, text: freshnessLabel(source) }
  }, [activity])

  const feedItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return narrativeItems
      .filter((a) => a !== featured)
      .filter((a) => {
        if (filter === 'all') return true
        if (filter === 'live' || filter === 'upcoming' || filter === 'recent') return a.status === filter
        return a.pulse_category === filter
      })
      .filter((a) => {
        if (!q) return true
        const haystack = `${a.title} ${a.description ?? ''} ${a.category ?? ''} ${a.source_name ?? ''}`.toLowerCase()
        return haystack.includes(q)
      })
  }, [narrativeItems, featured, filter, search])

  // Real African activity nodes (a curated ecosystem_activity row with
  // a known country) take priority over the aggregate builder-count
  // node for that same country — richer, specific detail beats a
  // generic count when both exist. No public activity has coordinates
  // yet, so today this list is empty and the map falls back entirely
  // to real builder-country counts below; the code stays ready for
  // when an admin adds one.
  const activityNodes: MapNode[] = useMemo(
    () =>
      (activity ?? [])
        .filter((a) => a.region === 'africa' && a.country)
        .map((a): MapNode | null => {
          const pos = positionFor(a.country as string)
          if (!pos) return null
          return { name: a.country as string, x: pos.x, y: pos.y, value: 7, detail: a.title }
        })
        .filter((n): n is MapNode => n !== null),
    [activity],
  )
  const mapNodes: MapNode[] = useMemo(() => {
    const covered = new Set(activityNodes.map((n) => n.name))
    const builderNodes = (countries ?? [])
      .filter((c) => !covered.has(c.name))
      .map((c): MapNode | null => {
        const pos = positionFor(c.name)
        if (!pos) return null
        return { name: c.name, x: pos.x, y: pos.y, value: c.count, detail: `${c.count} builder${c.count === 1 ? '' : 's'}` }
      })
      .filter((n): n is MapNode => n !== null)
    return [...activityNodes, ...builderNodes]
  }, [activityNodes, countries])

  async function load() {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .neq('status', 'draft')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
    if (error) {
      // Log the real technical error for developers; the visitor only
      // ever sees the friendly message below — never a raw DB error,
      // and never mistaken for "there just aren't any events".
      console.error('Failed to load events:', error)
      setLoadError(error.message)
      setEvents([])
      return
    }
    setLoadError(null)
    const rows = (data as EventListing[]) ?? []
    setEvents(rows)

    // One count per event, only for events with a capacity — visitors
    // never get read access to event_registrations itself, this RPC
    // returns nothing but a number.
    const withCapacity = rows.filter((e) => e.capacity !== null)
    if (withCapacity.length > 0) {
      const entries = await Promise.all(
        withCapacity.map(async (e) => {
          const { data: count } = await supabase.rpc('event_registration_count', { p_event_id: e.id })
          return [e.id, (count as number) ?? 0] as const
        }),
      )
      setCounts(Object.fromEntries(entries))
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Returning from Login after a logged-out visitor clicked an event
  // (see handleOpen below): re-open that same event's registration
  // modal automatically once the event list has loaded, then clear the
  // navigation state so it doesn't reopen again on a later visit.
  useEffect(() => {
    const openEventId = locationState?.openEventId
    if (!openEventId || !events) return
    const match = events.find((e) => e.id === openEventId)
    if (match) setSelected(match)
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, locationState?.openEventId])

  async function refreshCount(eventId: string) {
    const { data: count } = await supabase.rpc('event_registration_count', { p_event_id: eventId })
    setCounts((c) => ({ ...c, [eventId]: (count as number) ?? c[eventId] }))
  }

  // Event details/registration is an authenticated action (register_for_event
  // requires auth.uid()) — a logged-out visitor gets sent to Login instead
  // of a modal that would just fail. `from`/`eventId` are read back by
  // Login.tsx to return here and reopen this exact event afterward.
  function handleOpen(event: EventListing) {
    if (!session) {
      navigate('/login', { state: { from: '/events', eventId: event.id } })
      return
    }
    setSelected(event)
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal className="mb-10">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Monad Ecosystem Pulse</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">What's Happening in Monad?</h1>
          <p className="text-white/55 max-w-xl leading-relaxed mb-5">
            Live network activity, real ecosystem announcements, and builder momentum from across Monad —
            curated for Africa, not a calendar of dates.
          </p>
          {heroFreshness && (
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                heroFreshness.isLive ? 'border-emerald-300/30 text-emerald-300' : 'border-white/20 text-white/45'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${heroFreshness.isLive ? 'bg-emerald-300 animate-pulse' : 'bg-white/40'}`} />
              {heroFreshness.isLive ? 'Live ecosystem data' : heroFreshness.text}
            </span>
          )}
        </Reveal>

        {/* Compact live metrics — only genuinely live-synced rows ever
            land here; never a hardcoded number standing in for one. */}
        {liveStats.length > 0 && (
          <Reveal className="mb-12">
            <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
              {liveStats.map((stat) => (
                <div key={stat.id} className="shrink-0 min-w-[220px] rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-300/[0.06] via-panel to-ink p-5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300 mb-2">
                    <Radio size={11} className="animate-pulse" /> {freshnessLabel(stat)}
                  </span>
                  <div className="font-display font-semibold text-2xl">{stat.statistic_value}</div>
                  <div className="text-white/50 text-xs mt-0.5">{stat.statistic_label}</div>
                  {stat.source_url && (
                    <a href={stat.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-purple-light hover:text-white transition-colors mt-2">
                      {stat.source_name || 'Source'} <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Featured Moment — auto-picked, not hardcoded (see
            pickFeaturedMoment). Rotates as new activity is published. */}
        {featured && (
          <Reveal className="mb-14">
            <div className="relative rounded-[32px] border border-purple/30 bg-gradient-to-br from-purple/[0.08] via-panel to-ink p-8 md:p-10 overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-purple/40 text-purple-light">
                  <Sparkles size={11} /> Featured moment
                </span>
                <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${ACTIVITY_STATUS_STYLES[featured.status]}`}>{featured.status}</span>
                {featured.pulse_category && (
                  <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{PULSE_CATEGORY_LABELS[featured.pulse_category]}</span>
                )}
              </div>
              <h2 className="font-display font-semibold text-2xl md:text-[28px] leading-snug max-w-2xl mb-3">{featured.title}</h2>
              {featured.description && <p className="text-white/60 text-sm leading-relaxed max-w-xl mb-6">{featured.description}</p>}
              <div className="flex flex-wrap items-center gap-5">
                <span className="text-white/35 text-xs font-mono">{freshnessLabel(featured)}</span>
                {featured.location && <span className="text-white/45 text-xs">{featured.location}</span>}
                {featured.source_url && (
                  <a href={featured.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-light hover:text-white transition-colors">
                    View source <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        )}

        {/* Ecosystem Pulse feed */}
        <div className="mb-24">
          <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <h2 className="font-display font-semibold text-2xl">Happening now</h2>
          </Reveal>

          <Reveal className="mb-4">
            <div className="relative max-w-sm">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Monad activity…"
                className="input w-full text-sm pl-10"
              />
            </div>
          </Reveal>

          <Reveal className="flex gap-2 mb-8 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
            {PULSE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  filter === f.key ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55 hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </Reveal>

          {activity === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[0, 1].map((i) => <div key={i} className="h-48 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : feedItems.length === 0 ? (
            <EmptyState
              Icon={CalendarDays}
              message={
                search.trim()
                  ? `No activity matches "${search.trim()}".`
                  : narrativeItems.length === 0
                    ? 'No ecosystem activity published yet — check back soon as Monad Africa adds real, sourced updates.'
                    : 'Nothing published under this filter yet.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {feedItems.map((item, i) => (
                <Reveal key={item.id} delay={Math.min(i, 6) * 60}><ActivityCard item={item} /></Reveal>
              ))}
            </div>
          )}
        </div>

        {/* Africa is connecting to Monad — real nodes only: registered
            builder locations (leaderboard_public.country), plus any
            curated African activity with a known country (none yet). */}
        <div className="relative rounded-[40px] border border-white/10 bg-panel/30 p-8 md:p-12 mb-24 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 items-center">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-wider text-purple-light flex items-center gap-2"><Globe2 size={14} /> Africa is connecting to Monad</span>
              <h2 className="font-display font-semibold text-2xl md:text-3xl mt-4 mb-4">Real activity, real places.</h2>
              <p className="text-white/55 text-sm leading-relaxed max-w-md">
                Every node is a real country in the Monad Africa community, or a real piece of curated African
                ecosystem activity — never scattered or invented. Hover or tap a node for the detail behind it.
              </p>
            </Reveal>
            <Reveal delay={100}>
              {countries === null ? (
                <div className="aspect-[699/440] max-h-[420px] rounded-3xl bg-white/[0.02] animate-pulse" />
              ) : mapNodes.length === 0 ? (
                <div className="aspect-[699/440] max-h-[420px] rounded-3xl border border-dashed border-white/10 flex items-center justify-center px-6">
                  <p className="text-white/40 text-sm text-center">Map data will appear here as builders join and set their location.</p>
                </div>
              ) : (
                <AfricaNetworkMap nodes={mapNodes} interactive showLabels className="block w-full max-w-full h-auto max-h-[420px] mx-auto" />
              )}
            </Reveal>
          </div>
        </div>

        {/* Existing, unchanged: Monad Africa's own registerable events. */}
        <Reveal className="mb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Monad Africa events</span>
          <h2 className="font-display font-semibold text-2xl mt-3 mb-2">Meetups, workshops, and X Spaces you can register for.</h2>
          <p className="text-white/50 text-sm max-w-xl mb-10">Register to get your invite code — across the continent.</p>
        </Reveal>

        {events === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[0, 1].map((i) => <div key={i} className="h-80 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : loadError ? (
          <EmptyState
            Icon={CalendarDays}
            message={`Couldn’t load events right now.\n\n${loadError}\n\nPlease refresh the page — if this keeps happening, let us know.`}
          />
        ) : events.length === 0 ? (
          <EmptyState
            Icon={CalendarDays}
            message={'No upcoming events right now.\n\nFollow our channels to get notified the moment a new event is announced.'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {events.map((event, i) => (
              <Reveal key={event.id} delay={Math.min(i, 6) * 60}>
                <EventCard event={event} registeredCount={event.capacity !== null ? counts[event.id] ?? null : null} onOpen={() => handleOpen(event)} />
              </Reveal>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <EventRegistrationModal
            event={selected}
            registeredCount={selected.capacity !== null ? counts[selected.id] ?? null : null}
            onClose={() => setSelected(null)}
            onRegistered={() => refreshCount(selected.id)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

function ActivityCard({ item }: { item: EcosystemActivity }) {
  return (
    <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 flex flex-col gap-3 h-full hover:border-purple/40 transition-colors">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${ACTIVITY_STATUS_STYLES[item.status]}`}>{item.status}</span>
        {item.pulse_category && <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{PULSE_CATEGORY_LABELS[item.pulse_category]}</span>}
        {!item.pulse_category && item.category && <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{item.category}</span>}
        <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/40">{item.region === 'africa' ? 'Africa' : 'Global'}</span>
      </div>

      <h3 className="font-display font-semibold text-base leading-snug">{item.title}</h3>
      {item.description && <p className="text-white/55 text-sm leading-relaxed line-clamp-3">{item.description}</p>}

      {item.statistic_value && (
        <div className="pt-1">
          <span className="font-display font-semibold text-xl text-purple-light">{item.statistic_value}</span>
          {item.statistic_label && <span className="text-white/40 text-xs ml-2">{item.statistic_label}</span>}
        </div>
      )}

      {item.location && <div className="text-white/45 text-xs">{item.location}</div>}

      <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between gap-3">
        <span className="text-white/35 text-[11px] font-mono">{freshnessLabel(item)}</span>
        {item.source_url && (
          <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-purple-light hover:text-white transition-colors shrink-0">
            View source <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  )
}
