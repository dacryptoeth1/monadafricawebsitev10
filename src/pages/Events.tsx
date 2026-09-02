import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CalendarDays, ExternalLink, Radio } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { EcosystemActivity, EventListing } from '../types'
import { freshnessLabel, ACTIVITY_STATUS_STYLES } from '../lib/ecosystemActivity'
import EventCard from '../components/EventCard'
import EventRegistrationModal from '../components/EventRegistrationModal'
import EmptyState from '../components/EmptyState'
import Reveal from '../components/Reveal'

// This is deliberately NOT just a calendar. Two independent, real data
// sources feed this page:
//   1. ecosystem_activity (migration 0043) — "what's happening across
//      Monad right now": a live-synced stat (Monad TVL, refreshed by
//      api/sync-ecosystem-tvl.ts on a schedule), plus curated global +
//      African ecosystem intelligence, each with a real source and an
//      honest freshness label. See lib/ecosystemActivity.ts.
//   2. events / event_registrations — unchanged from before: Monad
//      Africa's own registerable meetups/workshops, with the existing
//      invite-code + check-in flow untouched.
const REGION_FILTERS = ['All', 'Global', 'Africa'] as const
type RegionFilter = (typeof REGION_FILTERS)[number]

export default function Events() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { openEventId?: string } | null

  const [activity, setActivity] = useState<EcosystemActivity[] | null>(null)
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('All')

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
  }, [])

  const liveStat = useMemo(() => (activity ?? []).find((a) => a.data_freshness === 'live' && a.statistic_value), [activity])
  const filteredActivity = useMemo(
    () =>
      (activity ?? [])
        .filter((a) => a !== liveStat) // the live stat gets its own hero treatment above, not repeated in the feed
        .filter((a) => regionFilter === 'All' || a.region === regionFilter.toLowerCase()),
    [activity, liveStat, regionFilter],
  )

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
        <Reveal className="mb-12">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Ecosystem activity</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">What's Happening Across Monad</h1>
          <p className="text-white/55 max-w-xl leading-relaxed">
            Monad Africa tracks current ecosystem activity and important developments across
            Africa and the wider Monad ecosystem — not just a calendar of dates.
          </p>
        </Reveal>

        {/* Live stat — only rendered when a genuinely live-synced row
            exists; never a hardcoded number standing in for one. */}
        {liveStat && (
          <Reveal className="mb-14">
            <div className="relative rounded-[32px] border border-emerald-300/25 bg-gradient-to-br from-emerald-300/[0.06] via-panel to-ink p-8 md:p-10 overflow-hidden">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-emerald-300/30 text-emerald-300 mb-4">
                    <Radio size={11} className="animate-pulse" /> {freshnessLabel(liveStat)}
                  </span>
                  <div className="font-display font-semibold text-4xl md:text-5xl">{liveStat.statistic_value}</div>
                  <div className="text-white/50 text-sm mt-1">{liveStat.statistic_label}</div>
                </div>
                {liveStat.source_url && (
                  <a href={liveStat.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-light hover:text-white transition-colors">
                    Source: {liveStat.source_name || 'View'} <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        )}

        {/* Ecosystem activity feed */}
        <div className="mb-24">
          <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <h2 className="font-display font-semibold text-2xl">Ecosystem intelligence</h2>
          </Reveal>
          <Reveal className="flex flex-wrap gap-2 mb-8">
            {REGION_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setRegionFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  regionFilter === f ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55 hover:bg-white/5'
                }`}
              >
                {f}
              </button>
            ))}
          </Reveal>

          {activity === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[0, 1].map((i) => <div key={i} className="h-48 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : filteredActivity.length === 0 ? (
            <EmptyState
              Icon={CalendarDays}
              message={
                regionFilter === 'Africa'
                  ? 'No African ecosystem activity published yet — check back soon as Monad Africa adds real, sourced updates.'
                  : 'No ecosystem activity published yet.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {filteredActivity.map((item, i) => (
                <Reveal key={item.id} delay={Math.min(i, 6) * 60}><ActivityCard item={item} /></Reveal>
              ))}
            </div>
          )}
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
        {item.category && <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{item.category}</span>}
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
            Source <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  )
}
