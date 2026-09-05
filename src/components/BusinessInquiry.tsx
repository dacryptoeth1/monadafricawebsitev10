import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Mail, X } from 'lucide-react'

// Replaces the old, abbreviated "BD" link (previously a footer item
// pointing straight at a personal Telegram account). "Business
// Inquiries" is now a real, named destination with the exact messaging
// the marketing lead specified, reachable from the Partners nav
// dropdown, the footer, and its own anchored section on /partners —
// all three opening the same content so there is one canonical answer
// to "how do I work with Monad Africa?".
export const BUSINESS_EMAIL = 'africamonad@gmail.com'

const HEADLINE = 'Looking to work with Monad Africa?'
const BODY =
  'For sponsorships, commercial opportunities, events, media, ecosystem initiatives, or other business inquiries, reach out to our team.'

// --- shared content ---------------------------------------------------

/**
 * The business-inquiry message itself. Rendered both inside the modal
 * (opened from the nav/footer) and as a standalone card in the
 * `#business-inquiries` section on /partners, so the wording can only
 * ever be defined once.
 */
export function BusinessInquiryBody({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div className="w-12 h-12 rounded-2xl bg-purple/15 border border-purple/25 text-purple-light flex items-center justify-center mb-5">
        <Briefcase size={20} />
      </div>
      <h3 className={`font-display font-semibold ${compact ? 'text-xl' : 'text-2xl md:text-3xl'} mb-4 text-balance`}>{HEADLINE}</h3>
      <p className="text-white/60 text-sm leading-relaxed max-w-xl mb-5">{BODY}</p>

      {/* The address is shown as plain, selectable text as well as being
          the button's target — someone who reads mail in a browser tab
          rather than a mail client still needs to be able to copy it. */}
      <a
        href={`mailto:${BUSINESS_EMAIL}`}
        className="inline-flex items-center gap-2 font-mono text-sm text-purple-light hover:text-white transition-colors break-all mb-7"
      >
        <Mail size={14} className="shrink-0" />
        {BUSINESS_EMAIL}
      </a>

      <div>
        <a
          href={`mailto:${BUSINESS_EMAIL}`}
          className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform"
        >
          <Mail size={16} /> Send Email
        </a>
      </div>
    </>
  )
}

/** The standalone, linkable version used on /partners (#business-inquiries). */
export function BusinessInquirySection() {
  return (
    <div id="business-inquiries" className="scroll-mt-28">
      <span className="font-mono text-xs uppercase tracking-wider text-gold">Business Inquiries</span>
      <div className="mt-5 rounded-squircle border border-white/10 bg-white/[0.02] p-8 md:p-10">
        <BusinessInquiryBody />
      </div>
    </div>
  )
}

// --- modal + provider -------------------------------------------------

const BusinessInquiryContext = createContext<{ open: () => void } | null>(null)

/**
 * Lets any element anywhere in the app (nav dropdown, mobile drawer,
 * footer) open the business-inquiry modal without each of them owning
 * their own copy of the dialog or its state.
 */
export function useBusinessInquiry() {
  const ctx = useContext(BusinessInquiryContext)
  if (!ctx) throw new Error('useBusinessInquiry must be used inside <BusinessInquiryProvider>')
  return ctx
}

export function BusinessInquiryProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open: () => setOpen(true) }), [])
  const close = useCallback(() => setOpen(false), [])

  // Escape closes, and the page behind stops scrolling while the dialog
  // is up — the same two things every other modal on the site does.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, close])

  return (
    <BusinessInquiryContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-ink/80 backdrop-blur-sm"
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Business inquiries"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              // Bottom sheet on phones, centered dialog from sm up; the
              // inner max-height + scroll means it can never overflow a
              // short landscape viewport.
              className="relative w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-[28px] sm:rounded-squircle border border-white/10 bg-panel p-7 sm:p-9 shadow-2xl"
            >
              <div className="absolute -z-10 inset-x-0 top-0 h-40 bg-gradient-to-b from-purple/15 to-transparent" />
              <button
                onClick={close}
                aria-label="Close"
                className="absolute top-5 right-5 w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
              <BusinessInquiryBody compact />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BusinessInquiryContext.Provider>
  )
}
