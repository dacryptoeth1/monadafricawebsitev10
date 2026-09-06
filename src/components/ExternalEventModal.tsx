import { motion } from 'framer-motion'
import { CalendarDays, ExternalLink, MapPin, X } from 'lucide-react'
import type { EventListing } from '../types'
import { formatEventDate, formatEventTime } from '../lib/eventStatus'
import { OrganiserLogo } from './EventCard'

// The detail view for an `is_external` event (migration 0050) — an
// event Monad Africa isn't collecting registrations for, so it never
// goes through EventRegistrationModal's login-gated registration form.
// Same modal chrome as EventRegistrationModal (backdrop + centered
// panel), just plain info plus the two real outbound links the brief
// asks for: the official event page (primary) and the X announcement.
export default function ExternalEventModal({ event, onClose }: { event: EventListing; onClose: () => void }) {
  const startTime = formatEventTime(event.start_time)
  const endTime = formatEventTime(event.end_time)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-squircle border border-white/10 bg-panel p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`${event.title} — event details`}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        <span className="font-mono text-[10px] uppercase tracking-wider text-purple-light">Event</span>
        <div className="flex items-center gap-3 mt-2 mb-1">
          <OrganiserLogo name={event.organiser_name || 'Monad Foundation'} logoUrl={event.organiser_logo_url} size={36} />
          <div>
            <h3 className="font-display font-semibold text-xl leading-snug">{event.title}</h3>
            <p className="text-white/40 text-xs mt-0.5">{event.organiser_name || 'Monad Foundation'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-white/50 text-xs mb-5 mt-4">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={12} /> {formatEventDate(event.event_date)}{startTime ? ` · ${startTime}${endTime ? ` – ${endTime}` : ''}` : ''}
          </span>
          {event.location && (
            <span className="flex items-center gap-1.5">
              <MapPin size={12} /> {event.location}
            </span>
          )}
        </div>

        {event.description && <p className="text-white/60 text-sm leading-relaxed mb-6">{event.description}</p>}

        <div className="flex flex-col sm:flex-row gap-2.5">
          {event.event_url && (
            <a
              href={event.event_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform"
            >
              View Event <ExternalLink size={13} />
            </a>
          )}
          {event.x_url && (
            <a
              href={event.x_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/10 transition-colors"
            >
              <span className="font-bold">𝕏</span> View on X
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
