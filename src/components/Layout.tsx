import { type ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, MessageCircle, Send, Bell, LayoutDashboard, User, LogOut } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { defaultSiteSettings } from '../types'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/about', label: 'About' },
  { to: '/bounties', label: 'Bounties' },
  { to: '/beginner-hub', label: 'Beginner Hub' },
  { to: '/ecosystem', label: 'Ecosystem' },
  { to: '/community', label: 'Community' },
  { to: '/partners', label: 'Partners' },
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
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="font-display font-semibold text-lg flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-xs">M</span>
            Monad Africa
          </Link>

          <div className="hidden lg:flex items-center gap-7 text-sm text-white/60 font-medium">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `hover:text-white transition-colors ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <AuthNavItems />
            <Link to="/host-bounty" className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
              Host a Bounty
            </Link>
            <Link to="/bounties" className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
              Explore Bounties
            </Link>
          </div>

          <button className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-white/15" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
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
            <div className="font-display font-semibold text-lg mb-3">Monad Africa</div>
            <p className="text-white/50 text-sm leading-relaxed">
              The gateway connecting the Monad ecosystem with Africa's next generation of
              builders, creators, and communities.
            </p>
            <div className="flex gap-3 mt-5">
              <a href={defaultSiteSettings.discord_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors">
                <MessageCircle size={15} />
              </a>
              <a href={defaultSiteSettings.x_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-xs font-bold">
                𝕏
              </a>
              <a href="#" className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors">
                <Send size={14} />
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-16">
            <FooterCol title="Explore" links={[
              { label: 'Bounties', href: '/bounties', internal: true },
              { label: 'Ecosystem', href: '/ecosystem', internal: true },
              { label: 'Beginner Hub', href: '/beginner-hub', internal: true },
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
  const { session, profile, isAdmin, signOut } = useAuth()
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
      <Link to="/dashboard" className="px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white transition-colors flex items-center gap-1.5">
        <LayoutDashboard size={14} /> Dashboard
      </Link>
      {!isAdmin && (
        <Link to="/profile" className="px-4 py-2.5 text-sm font-semibold text-white/70 hover:text-white transition-colors flex items-center gap-1.5">
          <User size={14} /> Profile
        </Link>
      )}
      <button
        onClick={async () => {
          await signOut()
          navigate('/')
        }}
        className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors"
        title="Logout"
      >
        <LogOut size={14} />
      </button>
    </>
  )
}

function MobileAuthItems({ onNavigate }: { onNavigate: () => void }) {
  const { session, signOut } = useAuth()
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
      <Link to="/dashboard" onClick={onNavigate} className="text-white/70 text-base">Dashboard</Link>
      <Link to="/profile" onClick={onNavigate} className="text-white/70 text-base">Profile</Link>
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
