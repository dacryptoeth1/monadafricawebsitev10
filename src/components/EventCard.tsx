import { CalendarDays, Clock, MapPin, Users } from 'lucide-react'
import type { EventListing } from '../types'
import { formatEventDate, formatEventTime, getRegistrationStatus } from '../lib/eventStatus'

const STATUS_STYLES: Record<string, string> = {
  open: 'text-emerald-300 border-emerald-300/30 bg-emerald-400/10',
  closed: 'text-white/50 border-white/20 bg-white/5',
  full: 'text-amber-300 border-amber-300/30 bg-amber-400/10',
  deadline_passed: 'text-white/50 border-white/20 bg-white/5',
  cancelled: 'text-rose-300 border-rose-300/30 bg-rose-400/10',
}

export default function EventCard({
  event,
  registeredCount,
  onOpen,
}: {
  event: EventListing
  registeredCount: number | null
  onOpen: () => void
}) {
  const info = getRegistrationStatus(event, registeredCount)
  const startTime = formatEventTime(event.start_time)
  const endTime = formatEventTime(event.end_time)

  return (
    <button
      onClick={onOpen}
      className="group text-left rounded-squircle border border-white/10 bg-white/[0.02] overflow-hidden hover:border-purple/40 hover:bg-white/[0.04] transition-colors flex flex-col"
    >
      <div className="relative h-40 bg-gradient-to-br from-purple/20 to-panel overflow-hidden shrink-0">
        {event.image_url ? (
          <img src={event.image_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CalendarDays size={32} className="text-purple-light/40" />
          </div>
        )}
        <span className={`absolute top-3 right-3 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATUS_STYLES[info.status]}`}>
          {info.label}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <h3 className="font-display font-semibold text-lg leading-snug">{event.title}</h3>
        {event.description && <p className="text-white/50 text-sm line-clamp-3">{event.description}</p>}

        <div className="mt-auto pt-2 flex flex-col gap-1.5 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <CalendarDays size={13} className="text-purple-light shrink-0" />
            {formatEventDate(event.event_date)}
          </div>
          {startTime && (
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-purple-light shrink-0" />
              {startTime}{endTime ? ` – ${endTime}` : ''}
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-purple-light shrink-0" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.capacity !== null && (
            <div className="flex items-center gap-2">
              <Users size={13} className="text-purple-light shrink-0" />
              {registeredCount ?? '—'} / {event.capacity} registered
            </div>
          )}
        </div>
      </div>
    </button>
  )
}
