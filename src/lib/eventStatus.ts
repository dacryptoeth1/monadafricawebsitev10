import type { EventListing } from '../types'

export type RegistrationStatus = 'open' | 'closed' | 'full' | 'deadline_passed' | 'cancelled'

export interface RegistrationStatusInfo {
  status: RegistrationStatus
  label: string
  canRegister: boolean
}

// Single source of truth for "can this visitor register right now" —
// used by both the event card badge and the registration modal, so the
// two never disagree about why a button is disabled. The RPC
// (register_for_event) re-checks every one of these server-side too —
// this is UI-only, never the actual security boundary.
export function getRegistrationStatus(event: EventListing, registeredCount: number | null): RegistrationStatusInfo {
  if (event.status === 'cancelled') {
    return { status: 'cancelled', label: 'Cancelled', canRegister: false }
  }
  if (!event.registration_open) {
    return { status: 'closed', label: 'Registration closed', canRegister: false }
  }
  if (event.registration_deadline && new Date(event.registration_deadline).getTime() < Date.now()) {
    return { status: 'deadline_passed', label: 'Registration deadline passed', canRegister: false }
  }
  if (event.capacity !== null && registeredCount !== null && registeredCount >= event.capacity) {
    return { status: 'full', label: 'Fully booked', canRegister: false }
  }
  return { status: 'open', label: 'Registration open', canRegister: true }
}

export function formatEventDate(dateStr: string | null | undefined): string {
  // event_date is a nullable `date` column (events created without a date
  // — e.g. via the simple Admin → Events tab — have event_date = null).
  // EventListing's TS type previously declared this non-nullable, so this
  // function assumed a real string and crashed with "Cannot read
  // properties of null (reading 'split')" the moment an admin's events
  // list included one such row (Admin → Event Registrations, and the
  // public /events page and its registration modal, all render every
  // event in one pass — one bad row broke the whole list for all three).
  if (!dateStr) return 'Date TBA'
  // event_date is a plain date (no time component) — parse as local,
  // not UTC, so it never shifts a day depending on the visitor's timezone.
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatEventTime(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
