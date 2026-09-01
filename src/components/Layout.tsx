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

const NAV = [
  { to: '/about', label: 'About' },
  { to: '/bounties', label: 'Bounties' },
  { to: '/events', label: 'Events' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/beginner-hub', label: 'Beginner Hub' },
  { to: '/ecosystem', label: 'Ecosystem' },
  { to: '/community', label: 'Community' },
  { to: '/team', label: 'Team' },
  { to: '/partners', label: 'Partners' },
  { to: '/partner', label: 'Partner With Us' },
  { to: '/contact', label: 'Contact' },
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
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="font-display font-semibold text-lg flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <MonadMark size={28} />
            Monad Africa
            <MonadOfficialBadge size={16} muted title="Built on Monad" />
          </Link>

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
            <Link to="/bounties" className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
              Explore Bounties
            </Link>
          </div>

          <button className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-white/15 shrink-0" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
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
                <Link to="/bounties" onClick={() => setMenuOpen(false)} className="px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple text-center">
                  Explore Bounties
                </Link>
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
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            <FooterCol title="Explore" links={[
              { label: 'Bounties', href: '/bounties', internal: true },
              { label: 'Ecosystem', href: '/ecosystem', internal: true },
              { label: 'Beginner Hub', href: '/beginner-hub', internal: true },
              { label: 'Team', href: '/team', internal: true },
            ]} />
            <FooterCol title="Partnerships" links={[
              { label: 'Partner With Us', href: '/partner', internal: true },
              { label: 'Business Development', href: '/team#business-development', internal: true },
              { label: 'Contact Lead BD', href: 'https://t.me/CryptoTesteer' },
            ]} />
            <FooterCol title="Community" links={[
              { label: 'Discord', href: defaultSiteSettings.discord_url },
              { label: 'X (Twitter)', href: defaultSiteSettings.x_url },
              { label: 'Contact', href: '/contact', internal: true },
            ]} />
            <FooterCol title="Resources" links={[
              { label: 'Monad Docs', href: 'https://docs.monad.xyz' },
              { label: 'Host a Bounty', href: '/host-bounty', internal: true },
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
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)

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
      <button
        onClick={async () => {
          await signOut()
          onNavigate()
          navigate('/')
        }}
        className="text-white/70 text-base text-left"
      >
        Logout
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
