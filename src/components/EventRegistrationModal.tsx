import { type FormEvent, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Check, Copy, ExternalLink, MapPin, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { sendInviteEmail } from '../lib/sendInviteEmail'
import { formatEventDate, formatEventTime, getRegistrationStatus } from '../lib/eventStatus'
import type { EventListing } from '../types'
import CountrySelect from './CountrySelect'
import EventVerificationPanel from './EventVerificationPanel'
import { OrganiserLogo } from './EventCard'

interface StoredRegistration {
  registrationId: string
  inviteCode: string
  fullName: string
  emailSent: boolean
  isNew: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function storageKey(eventId: string) {
  return `monad_event_registration_${eventId}`
}

// Reads/writes the "already registered for this event, this tab
// session" marker. Session-scoped (not localStorage) is intentional —
// it survives a refresh but not a new visit, and it is purely a UX
// convenience: the real duplicate-prevention guarantee is server-side
// (event_id + user_id, enforced inside register_for_event() and by a
// unique index), this just avoids re-hitting the RPC on every refresh.
function readStored(eventId: string): StoredRegistration | null {
  try {
    const raw = sessionStorage.getItem(storageKey(eventId))
    return raw ? (JSON.parse(raw) as StoredRegistration) : null
  } catch {
    return null
  }
}

function writeStored(eventId: string, value: StoredRegistration) {
  try {
    sessionStorage.setItem(storageKey(eventId), JSON.stringify(value))
  } catch {
    // sessionStorage unavailable (private mode, etc.) — non-fatal, the
    // registration itself already succeeded server-side either way.
  }
}

export default function EventRegistrationModal({
  event,
  registeredCount,
  onClose,
  onRegistered,
}: {
  event: EventListing
  registeredCount: number | null
  onClose: () => void
  onRegistered: () => void
}) {
  const [result, setResult] = useState<StoredRegistration | null>(() => readStored(event.id))
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>(result?.emailSent ? 'sent' : 'idle')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countryIso, setCountryIso] = useState('')
  const [countryName, setCountryName] = useState('')
  const [copied, setCopied] = useState(false)
  // Resend-specific in-flight guard. A ref (not just state) because it
  // must block a second click synchronously, before React has had a
  // chance to re-render and disable the button — two clicks dispatched
  // in quick succession can both run before either state update
  // commits, so checking React state alone isn't reliable here.
  const [resending, setResending] = useState(false)
  const resendingRef = useRef(false)
  // Same synchronous-guard pattern as resendingRef below: `submitting`
  // state alone isn't enough to stop a fast double-click on the
  // Register button, because React can batch/delay the re-render that
  // disables it — two clicks fired before either state update commits
  // could both reach handleSubmit. register_for_event() is already
  // idempotent server-side (a second call for the same user+event
  // returns the existing registration instead of erroring — see
  // is_new below), so this ref is a belt-and-suspenders guard against
  // firing a wasted duplicate network request, not the actual
  // duplicate-prevention guarantee.
  const submittingRef = useRef(false)

  const info = getRegistrationStatus(event, registeredCount)
  const startTime = formatEventTime(event.start_time)
  const endTime = formatEventTime(event.end_time)

  useEffect(() => {
    if (!result) return
    // Fire the confirmation email once, right after we land on the
    // success view for a brand-new registration (not for one restored
    // from a page refresh, where emailStatus is already known).
    if (emailStatus === 'idle') {
      setEmailStatus('sending')
      sendInviteEmail({ registrationId: result.registrationId, inviteCode: result.inviteCode }).then(({ ok }) => {
        setEmailStatus(ok ? 'sent' : 'failed')
        writeStored(event.id, { ...result, emailSent: ok })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.registrationId])

  async function handleResend() {
    // Bail out immediately (synchronously) if a resend is already in
    // flight — this is what actually stops rapid double-clicks from
    // firing two overlapping requests, whose responses could otherwise
    // arrive out of order and leave the status flickering between
    // "sent" and "failed" depending on which one resolved last.
    if (!result || resendingRef.current) return
    resendingRef.current = true
    setResending(true)
    setEmailStatus('sending')
    try {
      const { ok } = await sendInviteEmail({ registrationId: result.registrationId, inviteCode: result.inviteCode })
      setEmailStatus(ok ? 'sent' : 'failed')
      writeStored(event.id, { ...result, emailSent: ok })
    } catch (err) {
      // sendInviteEmail already catches its own errors and resolves
      // with { ok: false } — this catch is a second safety net so an
      // unexpected throw (e.g. writeStored failing) can never leave the
      // UI stuck on "Sending…" forever.
      console.error('[EventRegistrationModal] Resend failed unexpectedly:', err)
      setEmailStatus('failed')
    } finally {
      resendingRef.current = false
      setResending(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submittingRef.current) return
    setError(null)

    const data = new FormData(e.currentTarget)
    const fullName = String(data.get('full_name') || '').trim()
    const email = String(data.get('email') || '').trim()
    const twitter = String(data.get('twitter') || '').trim()
    const phone = String(data.get('phone') || '').trim()
    const walletAddress = String(data.get('wallet_address') || '').trim()

    if (!fullName) { setError('Full name is required.'); return }
    if (!email || !EMAIL_RE.test(email)) { setError('Enter a valid email address.'); return }
    if (!countryName) { setError('Select your country.'); return }

    submittingRef.current = true
    setSubmitting(true)
    const { data: rows, error: rpcError } = await supabase.rpc('register_for_event', {
      p_event_id: event.id,
      p_full_name: fullName,
      p_email: email,
      p_country: countryName,
      p_twitter: twitter || null,
      p_phone: phone || null,
      p_wallet_address: walletAddress || null,
    })
    submittingRef.current = false
    setSubmitting(false)

    if (rpcError) {
      // The friendly message below only recognizes register_for_event's
      // own intentional VALIDATION:/DUPLICATE_EMAIL:/etc. prefixes —
      // anything else (a raw Postgres/schema error) silently collapses
      // into the generic fallback message with no trace of what it
      // actually was. Log the real error so it's inspectable when
      // debugging a registration failure that isn't one of those known
      // cases.
      console.error('[Event registration] register_for_event failed:', rpcError)
      setError(friendlyRegistrationError(rpcError.message, (rpcError as any).code))
      return
    }
    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row) {
      setError('Something went wrong — please try again.')
      return
    }

    // is_new = false means this account already had a registration for
    // this event — register_for_event() returns that existing row
    // (with its real invite code) instead of erroring, so we can always
    // show/resend the code that actually exists rather than a dead end.
    const stored: StoredRegistration = {
      registrationId: row.registration_id,
      inviteCode: row.invite_code,
      fullName,
      emailSent: false,
      isNew: row.is_new !== false,
    }
    writeStored(event.id, stored)
    setResult(stored)
    onRegistered()
  }

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
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        {result ? (
          <SuccessView
            event={event}
            result={result}
            emailStatus={emailStatus}
            resending={resending}
            onResend={handleResend}
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(result.inviteCode).catch(() => {})
              setCopied(true)
              setTimeout(() => setCopied(false), 1600)
            }}
          />
        ) : (
          <>
            <span className="font-mono text-[10px] uppercase tracking-wider text-purple-light">Event registration</span>
            <div className="flex items-center gap-3 mt-2 mb-1">
              <OrganiserLogo name={event.organiser_name || 'Monad Africa'} logoUrl={event.organiser_logo_url} size={36} />
              <h3 className="font-display font-semibold text-xl">{event.title}</h3>
            </div>
            <div className="flex flex-col gap-1 text-white/50 text-xs mb-5">
              <span className="flex items-center gap-1.5"><CalendarDays size={12} /> {formatEventDate(event.event_date)}{startTime ? ` · ${startTime}${endTime ? ` – ${endTime}` : ''}` : ''}</span>
              {event.location && <span className="flex items-center gap-1.5"><MapPin size={12} /> {event.location}</span>}
            </div>

            {!info.canRegister ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/50">
                {info.status === 'full' ? 'This event has reached capacity — check back in case a spot opens up.' : info.status === 'cancelled' ? 'This event has been cancelled.' : info.label + '.'}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input name="full_name" placeholder="Full name *" required className="input" autoComplete="name" />
                <input name="email" type="email" placeholder="Email *" required className="input" autoComplete="email" />
                <CountrySelect value={countryIso} onChange={(iso, name) => { setCountryIso(iso); setCountryName(name) }} required />
                <input name="twitter" placeholder="X / Twitter username (optional)" className="input" />
                <input name="phone" type="tel" placeholder="Phone number (optional)" className="input" autoComplete="tel" />
                <input name="wallet_address" placeholder="Wallet address (optional)" className="input font-mono text-xs" />
                {error && <div className="text-xs text-rose-300">{error}</div>}
                <button type="submit" disabled={submitting} className="mt-1 px-5 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
                  {submitting ? 'Registering…' : 'Register'}
                </button>
              </form>
            )}
          </>
        )}

        {event.requires_email_verification && <EventVerificationPanel event={event} />}
      </motion.div>
    </motion.div>
  )
}

function SuccessView({
  event,
  result,
  emailStatus,
  resending,
  onResend,
  copied,
  onCopy,
}: {
  event: EventListing
  result: StoredRegistration
  emailStatus: 'idle' | 'sending' | 'sent' | 'failed'
  resending: boolean
  onResend: () => void
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
        <Check size={20} className="text-emerald-300" />
      </div>
      <h3 className="font-display font-semibold text-xl mb-1">{result.isNew ? 'Registration confirmed!' : "You're already registered"}</h3>
      <p className="text-white/55 text-sm mb-6">
        {result.isNew ? (
          <>Your registration for <span className="text-white">{event.title}</span> is confirmed.</>
        ) : (
          <>You already registered for <span className="text-white">{event.title}</span> — here's your invite code again.</>
        )}
      </p>

      <div className="text-left rounded-2xl border border-purple/30 bg-purple/5 p-5 mb-5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-purple-light mb-2">Your unique invite code</div>
        <div className="flex items-center justify-between gap-3">
          <code className="font-mono text-lg sm:text-xl tracking-wider text-white break-all">{result.inviteCode}</code>
          <button onClick={onCopy} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/10 transition-colors">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="text-left flex flex-col gap-1.5 text-xs text-white/50 mb-6">
        <span className="flex items-center gap-1.5"><CalendarDays size={12} /> {formatEventDate(event.event_date)}</span>
        {event.location && <span className="flex items-center gap-1.5"><MapPin size={12} /> {event.location}</span>}
        {event.event_url && (
          <a href={event.event_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-purple-light hover:underline">
            <ExternalLink size={12} /> Event link
          </a>
        )}
      </div>

      {emailStatus === 'failed' || resending ? (
        // Kept as one stable block for both "failed" and "actively
        // resending" — resending only ever transitions out of this
        // block (to "sent" or back to "failed"), it never swaps to a
        // different element mid-click, so there's no layout jump for
        // the button to get lost in during a click.
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 mb-2 text-xs text-amber-200 flex flex-col gap-2">
          <span>
            {resending
              ? 'Sending your confirmation email…'
              : "We couldn't send your confirmation email, but your registration and invite code are safely saved."}
          </span>
          <button
            onClick={onResend}
            disabled={resending}
            aria-busy={resending}
            className="self-center px-4 py-2 rounded-full text-xs font-semibold border border-amber-300/40 hover:bg-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? 'Sending…' : 'Resend email'}
          </button>
        </div>
      ) : emailStatus === 'sending' ? (
        <p className="text-white/35 text-xs">Sending your confirmation email…</p>
      ) : (
        <p className="text-white/40 text-xs">Confirmation email sent. Please keep your code safe and present it when you arrive at the event.</p>
      )}
    </div>
  )
}

function friendlyRegistrationError(message: string, code?: string): string {
  // DUPLICATE_EMAIL is no longer raised by register_for_event() — an
  // already-registered account now gets its existing invite code back
  // as a normal successful return (see handleSubmit), not an error.
  // This case is kept only in case an older, un-migrated database is
  // still running the previous version of the function.
  if (message.startsWith('DUPLICATE_EMAIL')) return "You're already registered for this event — check your inbox for your invite code."
  if (message.startsWith('CAPACITY_FULL')) return 'This event just reached capacity.'
  if (message.startsWith('CLOSED')) return 'Registration is closed for this event.'
  if (message.startsWith('DEADLINE_PASSED')) return 'The registration deadline for this event has passed.'
  if (message.startsWith('VALIDATION:')) return message.replace('VALIDATION: ', '')
  if (message.startsWith('NOT_FOUND')) return 'This event could not be found.'
  // TEMPORARY diagnostic fallback — surfaces the real Supabase/Postgres
  // error instead of a generic message, so a failure that isn't one of
  // register_for_event's own intentional cases above is visible without
  // needing DevTools. Revert to a plain generic message once the root
  // cause behind this fallback firing is found and fixed.
  return `Something went wrong submitting your registration: ${message}${code ? ` (code: ${code})` : ''}`
}
