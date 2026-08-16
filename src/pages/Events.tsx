import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { EventListing } from '../types'
import EventCard from '../components/EventCard'
import EventRegistrationModal from '../components/EventRegistrationModal'
import EmptyState from '../components/EmptyState'
import Reveal from '../components/Reveal'

export default function Events() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { openEventId?: string } | null
  const [events, setEvents] = useState<EventListing[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<EventListing | null>(null)

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
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Upcoming events</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">Meet the Monad Africa community.</h1>
          <p className="text-white/55 max-w-xl mb-10">Meetups, workshops, and X Spaces across the continent — register to get your invite code.</p>
        </Reveal>

        {events === null ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-80 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : loadError ? (
          <EmptyState
            Icon={CalendarDays}
            message={'Couldn’t load events right now.\n\nPlease refresh the page — if this keeps happening, let us know.'}
          />
        ) : events.length === 0 ? (
          <EmptyState
            Icon={CalendarDays}
            message={'No upcoming events right now.\n\nFollow our channels to get notified the moment a new event is announced.'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
