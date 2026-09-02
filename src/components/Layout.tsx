import { type ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, MessageCircle, Send, Bell, LayoutDashboard, User, LogOut, ShieldCheck, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { defaultSiteSettings } from '../types'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import AnnouncementBanner from './AnnouncementBanner'
import MonadMark from './MonadMark'
import MonadOfficialBadge from './MonadOfficialBadge'

// The site's entire primary navigation, on purpose: seven items
// (Explore / Beginners Hub / Team / Events / Opportunities / Community
// / Partners), each with its own dedicated page — Beginners Hub and
// Events specifically are NOT nested inside Explore, per the brief.
// Every other existing page (About, Ecosystem, Leaderboard, Builders
// directory, Partner With Us, Contact, Host a Bounty) is still a live
// route — none were removed — just reachable from inside these hub
// pages and the footer instead of competing for space in the top nav.
//
// "Team" -> /team (the curated official Monad Africa roster,
// team_members) is deliberately NOT the same thing as /builders (the
// wider community leaderboard directory) — see Home.tsx's TeamPreview.
// "Opportunities" -> /opportunities is the canonical path; /bounties
// still works and redirects (see App.tsx), so no old link breaks.
const NAV = [
  { to: '/explore', label: 'Explore' },
  { to: '/beginners', label: 'Beginners Hub' },
  { to: '/team', label: 'Team' },
  { to: '/events', label: 'Events' },
  { to: '/opportunities', label: 'Opportunities' },
  { to: '/community', label: 'Community' },
  { to: '/partners', label: 'Partners' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-ink/80 backdrop-blur-md border-b border-white/10 py-3' : 'py-5'}`}>
        <AnnouncementBanner />
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-3">
          {/* Hamburger + logo grouped on the LEFT (mobile-first pattern —
              the trigger sits right next to the brand it opens the menu
              for, instead of on the opposite side of the screen). */}
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-white/15 shrink-0" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Link to="/" className="font-display font-semibold text-lg flex items-center gap-2 min-w-0" onClick={() => setMenuOpen(false)}>
              <MonadMark size={28} />
              <span className="truncate">Monad Africa</span>
              <MonadOfficialBadge size={16} muted title="Built on Monad" className="hidden sm:inline-flex" />
            </Link>
          </div>

          {/* Full link row only at xl+ (1280px) — below that, the same
              links live in the "More" dropdown instead of competing for
              space with the account cluster / CTAs, which is what used
              to squeeze Sign Out off-screen on medium desktop widths. */}
          <div className="hidden xl:flex items-center gap-7 text-sm text-white/60 font-medium shrink-0">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `hover:text-white transition-colors ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
          <MoreNavMenu />

          {/* shrink-0 + always-rendered Sign Out inside AuthNavItems —
              this cluster never yields space to anything else, so it
              can't be pushed off-screen the way individual auth links
              could be when they lived directly in this row. */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <AuthNavItems />
            <Link to="/host-bounty" className="hidden xl:inline-flex px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
              Host a Bounty
            </Link>
            <JoinCta className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform" />
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
              className="lg:hidden overflow-hidden bg-ink/95 backdrop-blur border-t border-white/10 mt-4"
            >
              <div className="px-6 py-6 flex flex-col gap-4">
                {NAV.map((item) => (
                  <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="text-white/70 text-base">
                    {item.label}
                  </Link>
                ))}
                <MobileAuthItems onNavigate={() => setMenuOpen(false)} />
                <Link to="/host-bounty" onClick={() => setMenuOpen(false)} className="mt-2 px-5 py-3 rounded-full text-sm font-semibold border border-white/15 text-center">
                  Host a Bounty
                </Link>
                <JoinCta onClick={() => setMenuOpen(false)} className="px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple text-center" fallback={{ to: '/opportunities', label: 'Explore Opportunities' }} />
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
              <a href={defaultSiteSettings.discord_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors">
                <MessageCircle size={15} />
              </a>
              <a href={defaultSiteSettings.x_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-xs font-bold">
                𝕏
              </a>
              <a href={defaultSiteSettings.telegram_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Send size={14} />
              </a>
            </div>
          </div>
          {/* Mirrors the main nav's pillars — every other existing page
              (Ecosystem, Leaderboard, Builders directory, Contact, ...)
              is still live, just organized here alongside them instead
              of adding more items to the top nav. */}
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            <FooterCol title="Explore" links={[
              { label: 'Explore', href: '/explore', internal: true },
              { label: 'Beginners Hub', href: '/beginners', internal: true },
              { label: 'Ecosystem', href: '/ecosystem', internal: true },
              { label: 'About', href: '/about', internal: true },
              { label: 'Monad Docs', href: 'https://docs.monad.xyz' },
            ]} />
            <FooterCol title="Team" links={[
              { label: 'Team', href: '/team', internal: true },
              { label: 'Builder Directory', href: '/builders', internal: true },
              { label: 'Leaderboard', href: '/leaderboard', internal: true },
            ]} />
            <FooterCol title="Opportunities" links={[
              { label: 'Opportunities', href: '/opportunities', internal: true },
              { label: 'Host an Opportunity', href: '/host-bounty', internal: true },
            ]} />
            <FooterCol title="Community" links={[
              { label: 'Community', href: '/community', internal: true },
              { label: 'Events', href: '/events', internal: true },
              { label: 'Contact', href: '/contact', internal: true },
            ]} />
            <FooterCol title="Partners" links={[
              { label: 'Partners', href: '/partners', internal: true },
              { label: 'Partner With Us', href: '/partner', internal: true },
              { label: 'Contact BD', href: 'https://t.me/CryptoTesteer' },
            ]} />
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
        <Link to="/signup" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
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

function MoreNavMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative hidden lg:block xl:hidden shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors font-medium"
      >
        More <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={() => setOpen(false)}
            className="absolute left-0 top-9 w-52 rounded-2xl border border-white/10 bg-panel shadow-xl p-2 z-50 flex flex-col"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `px-3 py-2.5 rounded-xl text-sm transition-colors ${isActive ? 'text-white bg-white/5' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
              >
                {item.label}
              </NavLink>
            ))}
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

function FooterCol({ title, links }: { title: string; links: { label: string; href: string; internal?: boolean }[] }) {
  return (
    <div>
      <h5 className="font-mono text-[11px] uppercase tracking-wider text-white/40 mb-4">{title}</h5>
      <div className="flex flex-col gap-2.5">
        {links.map((l) =>
          l.internal ? (
            <Link key={l.label} to={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</Link>
          ) : (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</a>
          ),
        )}
      </div>
    </div>
  )
}
