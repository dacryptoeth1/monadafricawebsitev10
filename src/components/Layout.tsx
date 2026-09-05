import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, MessageCircle, Send, Bell, LayoutDashboard, User, LogOut, ShieldCheck, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { defaultSiteSettings } from '../types'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import AnnouncementBanner from './AnnouncementBanner'
import MonadMark from './MonadMark'
import MonadOfficialBadge from './MonadOfficialBadge'
import { BusinessInquiryProvider, useBusinessInquiry } from './BusinessInquiry'

// --- navigation model -------------------------------------------------

type NavItem =
  | { label: string; to: string }
  | { label: string; href: string }
  | { label: string; action: 'business-inquiry' }

interface NavSection {
  /** Column heading inside the dropdown. */
  title: string
  items: NavItem[]
}

interface NavGroup {
  /** The label shown in the top bar. */
  label: string
  /** Where clicking the top-bar label itself goes — always a real page. */
  to: string
  sections: NavSection[]
}

// Exactly four visible items in the desktop bar — Explore / Events /
// Opportunity / Partners — with everything else reachable from their
// dropdowns, per the marketing lead's brief. Nothing was removed: every
// page that used to sit in the top bar (Beginners Hub, Team, Community)
// is still a live route, now grouped under the pillar it belongs to
// instead of competing for horizontal space. The same groups drive the
// mobile drawer and the footer, so the three can't drift apart.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Explore',
    to: '/explore',
    sections: [
      {
        title: 'Explore',
        items: [
          { label: 'Explore', to: '/explore' },
          { label: 'Beginners Hub', to: '/beginners' },
          { label: 'Ecosystem', to: '/ecosystem' },
          { label: 'About', to: '/about' },
          { label: 'Monad Docs', href: 'https://docs.monad.xyz' },
        ],
      },
      {
        // The brief listed Team / Builders as its own group but capped
        // the visible bar at four items — so it lives as a second column
        // under Explore ("explore the people", alongside "explore the
        // ecosystem") rather than becoming a fifth top-level item.
        title: 'Team / Builders',
        items: [
          { label: 'Team', to: '/team' },
          { label: 'Builder Directory', to: '/builders' },
          { label: 'Leaderboard', to: '/leaderboard' },
        ],
      },
    ],
  },
  {
    label: 'Events',
    to: '/events',
    sections: [
      {
        title: 'Community',
        items: [
          { label: 'Community', to: '/community' },
          { label: 'Events', to: '/events' },
          // Both live as sections of /community rather than standalone
          // pages — "everything should open in the community aspect."
          { label: 'Monad Spaces', to: '/community#spaces' },
          { label: 'Community Stories', to: '/community#stories' },
          { label: 'Contact', to: '/contact' },
        ],
      },
    ],
  },
  {
    label: 'Opportunity',
    to: '/opportunities',
    sections: [
      {
        title: 'Opportunities',
        items: [
          { label: 'Opportunities', to: '/opportunities' },
          { label: 'Host an Opportunity', to: '/host-bounty' },
        ],
      },
    ],
  },
  {
    label: 'Partners',
    to: '/partners',
    sections: [
      {
        title: 'Partners',
        items: [
          { label: 'Partners', to: '/partners' },
          { label: 'Partner With Us', to: '/partners#partner-form' },
          // Was the abbreviated "BD" link pointing at a personal
          // Telegram — now opens the real business-inquiry dialog.
          { label: 'Business Inquiries', action: 'business-inquiry' },
        ],
      },
    ],
  },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <BusinessInquiryProvider>
      <LayoutShell>{children}</LayoutShell>
    </BusinessInquiryProvider>
  )
}

function LayoutShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A hash link inside the drawer (/community#spaces) that points at the
  // page you're already on doesn't change `location.pathname`, so the
  // drawer has to close on any location change, not just navigation.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.hash])

  return (
    <div className="min-h-screen flex flex-col">
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-ink/80 backdrop-blur-md border-b border-white/10 py-3' : 'py-5'}`}>
        <AnnouncementBanner />
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-3">
          {/* Hamburger + logo grouped on the LEFT (mobile-first pattern —
              the trigger sits right next to the brand it opens the menu
              for, instead of on the opposite side of the screen). */}
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-white/15 shrink-0" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" aria-expanded={menuOpen}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link to="/" className="font-display font-semibold text-lg flex items-center gap-2 min-w-0" onClick={() => setMenuOpen(false)}>
              <MonadMark size={28} />
              <span className="truncate">Monad Africa</span>
              <MonadOfficialBadge size={16} muted title="Built on Monad" className="hidden sm:inline-flex" />
            </Link>
          </div>

          {/* Four items, full width from lg (1024px) up — where the old
              seven-item row only fit at xl and had to spill into a
              "More" menu between 1024px and 1280px. */}
          <div className="hidden lg:flex items-center gap-1 text-sm font-medium shrink-0">
            {NAV_GROUPS.map((group) => (
              <DesktopNavGroup key={group.label} group={group} />
            ))}
          </div>

          {/* shrink-0 + always-rendered Sign Out inside AuthNavItems —
              this cluster never yields space to anything else, so it
              can't be pushed off-screen the way individual auth links
              could be when they lived directly in this row. */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <AuthNavItems />
            <Link to="/host-bounty" className="hidden xl:inline-flex px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors whitespace-nowrap">
              Host an Opportunity
            </Link>
            <JoinCta className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform whitespace-nowrap" />
          </div>

          {/* RIGHT, mobile only (<sm): login/profile/primary action,
              since the fuller cluster above is hidden below sm. */}
          <MobileCompactAuth />
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden overflow-hidden bg-ink backdrop-blur border-t border-white/10 mt-4"
            >
              {/* Capped height + its own scroll: the full hierarchy is
                  long enough to run past a 360×640 phone viewport, and a
                  drawer you can't scroll is a drawer whose bottom items
                  are unreachable. */}
              <div className="px-6 py-6 flex flex-col gap-5 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label}>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-purple-light">{group.label}</span>
                    <div className="flex flex-col gap-3 mt-3">
                      {group.sections.flatMap((section) => section.items).map((item) => (
                        <MobileNavItem key={item.label} item={item} onNavigate={() => setMenuOpen(false)} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-white/10 flex flex-col gap-4">
                  <MobileAuthItems onNavigate={() => setMenuOpen(false)} />
                  <Link to="/host-bounty" onClick={() => setMenuOpen(false)} className="px-5 py-3 rounded-full text-sm font-semibold border border-white/15 text-center">
                    Host an Opportunity
                  </Link>
                  <JoinCta onClick={() => setMenuOpen(false)} className="px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple text-center" fallback={{ to: '/opportunities', label: 'Explore Opportunities' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="flex-1">{children}</main>

      <Footer />
    </div>
  )
}

// One top-bar item and its dropdown. The label itself is a real link to
// that pillar's own page (so "Explore" / "Events" / "Opportunity" /
// "Partners" each still go somewhere on click, including for anyone
// navigating by keyboard or touch), while hover/focus reveals the rest
// of the group underneath it.
function DesktopNavGroup({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const location = useLocation()

  // Close whenever the route changes, so the menu never hangs open over
  // the page it just navigated to.
  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  function openNow() {
    window.clearTimeout(closeTimer.current)
    setOpen(true)
  }
  // A short grace period on leave — without it the menu snaps shut in
  // the few pixels of gap between the trigger and the panel below it.
  function closeSoon() {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 120)
  }

  const wide = group.sections.length > 1

  return (
    <div
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      onFocus={openNow}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <NavLink
        to={group.to}
        className={({ isActive }) =>
          `flex items-center gap-1.5 px-3 py-2 rounded-full transition-colors ${isActive || open ? 'text-white' : 'text-white/60 hover:text-white'}`
        }
        aria-expanded={open}
      >
        {group.label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </NavLink>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            // left-0 + a max-width that can never exceed the viewport
            // keeps the panel on screen at 1024px, where the rightmost
            // group sits close to the edge.
            className={`absolute left-0 top-full pt-3 z-50 ${wide ? 'w-[30rem] max-w-[calc(100vw-3rem)]' : 'w-56'}`}
          >
            <div className={`rounded-2xl border border-white/10 bg-panel shadow-xl p-3 ${wide ? 'grid grid-cols-2 gap-2' : 'flex flex-col'}`}>
              {group.sections.map((section) => (
                <div key={section.title} className="flex flex-col">
                  {wide && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/35 px-3 pt-2 pb-1.5">{section.title}</span>
                  )}
                  {section.items.map((item) => (
                    <DesktopNavItem key={item.label} item={item} onSelect={() => setOpen(false)} />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const DROPDOWN_ITEM_CLASS = 'px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors text-left'

function DesktopNavItem({ item, onSelect }: { item: NavItem; onSelect: () => void }) {
  const { open } = useBusinessInquiry()

  if ('action' in item) {
    return (
      <button
        onClick={() => {
          onSelect()
          open()
        }}
        className={DROPDOWN_ITEM_CLASS}
      >
        {item.label}
      </button>
    )
  }
  if ('href' in item) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onSelect} className={DROPDOWN_ITEM_CLASS}>
        {item.label}
      </a>
    )
  }
  return (
    <Link to={item.to} onClick={onSelect} className={DROPDOWN_ITEM_CLASS}>
      {item.label}
    </Link>
  )
}

function MobileNavItem({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { open } = useBusinessInquiry()

  if ('action' in item) {
    return (
      <button
        onClick={() => {
          onNavigate()
          open()
        }}
        className="text-white/70 text-base text-left"
      >
        {item.label}
      </button>
    )
  }
  if ('href' in item) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className="text-white/70 text-base">
        {item.label}
      </a>
    )
  }
  return (
    <Link to={item.to} onClick={onNavigate} className="text-white/70 text-base">
      {item.label}
    </Link>
  )
}

function Footer() {
  return (
    <footer className="border-t border-white/10 py-14">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-wrap justify-between gap-10 mb-12">
          <div className="max-w-xs">
            <div className="font-display font-semibold text-lg mb-3 flex items-center gap-2"><MonadMark size={22} /> Monad Africa</div>
            <p className="text-white/50 text-sm leading-relaxed">
              The gateway connecting the Monad ecosystem with Africa's next generation of
              builders, creators, and communities.
            </p>
            <div className="flex items-center gap-2 mt-4 text-white/35 text-xs font-mono">
              <MonadOfficialBadge size={16} />
              Built for the Monad Ecosystem
            </div>
            <div className="flex gap-3 mt-5">
              <a href={defaultSiteSettings.discord_url} target="_blank" rel="noopener noreferrer" aria-label="Discord" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors">
                <MessageCircle size={15} />
              </a>
              <a href={defaultSiteSettings.x_url} target="_blank" rel="noopener noreferrer" aria-label="X" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-xs font-bold">
                𝕏
              </a>
              <a href={defaultSiteSettings.telegram_url} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Send size={14} />
              </a>
            </div>
          </div>
          {/* Generated from the exact same NAV_GROUPS the top bar and the
              mobile drawer use, so the footer can never quietly drift out
              of sync with the navigation again. */}
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            {NAV_GROUPS.flatMap((group) => group.sections).map((section) => (
              <FooterCol key={section.title} title={section.title} items={section.items} />
            ))}
          </div>
        </div>
        <div className="pt-6 border-t border-white/10 flex flex-wrap justify-between gap-3 text-xs text-white/40">
          <span>© {new Date().getFullYear()} Monad Africa. All rights reserved.</span>
          <span>Built for the Monad ecosystem.</span>
        </div>
      </div>
    </footer>
  )
}

// The compact right-side element on a true mobile header (<sm) — the
// fuller AuthNavItems cluster (notifications, account dropdown, sign
// out, CTA buttons) only appears at sm+, so below that this is the only
// way to reach login/signup or the signed-in account. Deliberately just
// one element: a small "Get Started" pill when signed out, or an avatar
// initial linking to the dashboard when signed in.
function MobileCompactAuth() {
  const { session, profile } = useAuth()

  if (!session) {
    return (
      <Link
        to="/signup"
        className="sm:hidden shrink-0 px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple whitespace-nowrap"
      >
        Get Started
      </Link>
    )
  }

  const initial = (profile?.full_name || profile?.username || '?').slice(0, 1).toUpperCase()
  return (
    <Link
      to="/dashboard"
      aria-label="Go to dashboard"
      className="sm:hidden shrink-0 w-10 h-10 rounded-full border border-white/15 bg-white/5 flex items-center justify-center overflow-hidden font-display font-semibold text-sm"
    >
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : initial}
    </Link>
  )
}

// The header's single "Join Monad Africa" CTA (reference-matched) —
// only makes sense for a logged-out visitor, since a signed-in one has
// already joined and gets the account cluster instead. `fallback` lets
// a slot that must always show *something* (the mobile drawer's bottom
// button) swap in a different real destination once signed in, instead
// of just disappearing.
function JoinCta({ className, onClick, fallback }: { className: string; onClick?: () => void; fallback?: { to: string; label: string } }) {
  const { session } = useAuth()
  if (session) {
    if (!fallback) return null
    return <Link to={fallback.to} onClick={onClick} className={className}>{fallback.label}</Link>
  }
  return (
    <Link to="/signup" onClick={onClick} className={className}>
      Join Monad Africa
    </Link>
  )
}

function AuthNavItems() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  if (!session) {
    return (
      <>
        <Link to="/login" className="px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white transition-colors">
          Login
        </Link>
        <Link to="/signup" className="hidden md:inline-flex px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
          Sign Up
        </Link>
      </>
    )
  }

  return (
    <>
      <NotificationBell />
      <AccountMenu />
      {/* Always rendered, never collapsed into a menu — this is the
          element that used to get squeezed off-screen. */}
      <button
        onClick={async () => {
          await signOut()
          navigate('/')
        }}
        className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
        title="Sign Out"
        aria-label="Sign Out"
      >
        <LogOut size={14} />
      </button>
    </>
  )
}

function AccountMenu() {
  const { isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors"
      >
        <LayoutDashboard size={14} /> Account <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => setOpen(false)}
            className="absolute right-0 top-12 w-56 rounded-2xl border border-white/10 bg-panel shadow-xl p-2 z-50 flex flex-col"
          >
            {isAdmin && (
              <Link to="/admin" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-purple-light hover:bg-white/5 transition-colors">
                <ShieldCheck size={14} /> Admin Dashboard
              </Link>
            )}
            <Link to="/dashboard" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
              <LayoutDashboard size={14} /> Dashboard
            </Link>
            {!isAdmin && (
              <Link to="/profile" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                <User size={14} /> Profile
              </Link>
            )}
            {!isAdmin && (
              <Link to="/activity" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                Activity
              </Link>
            )}
            {!isAdmin && (
              <Link to="/settings" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                Settings
              </Link>
            )}
            {/* Divider + rose color makes this read as a distinct,
                clearly-visible action underneath the account links
                above, not just one more item in the list. */}
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-rose-300 hover:bg-rose-300/10 transition-colors text-left"
            >
              <LogOut size={14} /> Logout
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MobileAuthItems({ onNavigate }: { onNavigate: () => void }) {
  const { session, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  if (!session) {
    return (
      <>
        <Link to="/login" onClick={onNavigate} className="text-white/70 text-base">Login</Link>
        <Link to="/signup" onClick={onNavigate} className="text-white/70 text-base">Sign Up</Link>
      </>
    )
  }

  return (
    <>
      {isAdmin && <Link to="/admin" onClick={onNavigate} className="text-purple-light text-base font-semibold">Admin Dashboard</Link>}
      <Link to="/dashboard" onClick={onNavigate} className="text-white/70 text-base">Dashboard</Link>
      <Link to="/profile" onClick={onNavigate} className="text-white/70 text-base">Profile</Link>
      <Link to="/activity" onClick={onNavigate} className="text-white/70 text-base">Activity</Link>
      <Link to="/settings" onClick={onNavigate} className="text-white/70 text-base">Settings</Link>
      {/* Visually separated from the account links above (divider +
          rose color + icon) so it reads as a clearly distinct, findable
          action rather than blending in as one more nav link. */}
      <button
        onClick={async () => {
          await signOut()
          onNavigate()
          navigate('/')
        }}
        className="flex items-center gap-2 text-rose-300 text-base text-left pt-4 mt-1 border-t border-white/10"
      >
        <LogOut size={17} /> Logout
      </button>
    </>
  )
}

function NotificationBell() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<{ id: string; title: string; message: string | null; read: boolean }[]>([])

  async function load() {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, read, user_id')
      .or(`user_id.eq.${profile.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(10)
    setItems(data ?? [])
  }

  useEffect(() => {
    load()
  }, [profile?.id])

  const unread = items.filter((n) => !n.read).length

  async function markRead() {
    if (!profile) return
    const mine = items.filter((n) => !n.read)
    if (mine.length === 0) return
    await Promise.all(mine.map((n) => supabase.from('notifications').update({ read: true }).eq('id', n.id)))
    load()
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v)
          if (!open) markRead()
        }}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors"
      >
        <Bell size={14} />
        {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple text-[9px] flex items-center justify-center">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 top-12 w-72 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-panel shadow-xl p-2 z-50"
          >
            {items.length === 0 ? (
              <div className="text-white/40 text-xs p-4 text-center">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="p-3 rounded-xl hover:bg-white/5">
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.message && <div className="text-white/50 text-xs mt-0.5">{n.message}</div>}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FooterCol({ title, items }: { title: string; items: NavItem[] }) {
  const { open } = useBusinessInquiry()

  return (
    <div>
      <h5 className="font-mono text-[11px] uppercase tracking-wider text-white/40 mb-4">{title}</h5>
      <div className="flex flex-col gap-2.5 items-start">
        {items.map((item) =>
          'action' in item ? (
            <button key={item.label} onClick={open} className="text-sm text-white/60 hover:text-white transition-colors text-left">
              {item.label}
            </button>
          ) : 'href' in item ? (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="text-sm text-white/60 hover:text-white transition-colors">
              {item.label}
            </a>
          ) : (
            <Link key={item.label} to={item.to} className="text-sm text-white/60 hover:text-white transition-colors">
              {item.label}
            </Link>
          ),
        )}
      </div>
    </div>
  )
}
