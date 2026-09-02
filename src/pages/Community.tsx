import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, MessageCircle, Send, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { formatEventDate } from '../lib/eventStatus'
import type { EventListing, PublicProfile } from '../types'
import Reveal from '../components/Reveal'
import Counter from '../components/Counter'
import BuilderCard from '../components/BuilderCard'
import CommunityStats from '../components/CommunityStats'
import { OrganiserLogo } from '../components/EventCard'

// Real X/Discord/Telegram counts now live in CommunityStats
// (community_stats table, migration 0044 — written only by
// scripts/sync-community-stats.mjs, run by GitHub Actions). That
// superseded this page's old
// client-side fetchDiscordWidget() call, which only ever surfaced
// Discord's *online presence* count, not a true member total.
export default function Community() {
  const settings = useSiteSettings()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventListing[] | null>(null)
  const [contributors, setContributors] = useState<PublicProfile[] | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(4)
      .then(({ data }) => setEvents((data as EventListing[]) ?? []))

    supabase
      .from('leaderboard_public')
      .select('id, username, full_name, avatar_url, country, xp, total_referrals')
      .order('xp', { ascending: false })
      .limit(3)
      .then(({ data }) => setContributors((data as PublicProfile[]) ?? []))
  }, [])

  function openEvent(event: EventListing) {
    if (!session) {
      navigate('/login', { state: { from: '/events', eventId: event.id } })
      return
    }
    navigate('/events', { state: { openEventId: event.id } })
  }

  const channels = [
    { icon: MessageCircle, title: 'Discord', desc: 'Where the community lives day to day.', href: settings.discord_url },
    { icon: Star, title: 'X (Twitter)', desc: 'Announcements, threads, and Spaces.', href: settings.x_url },
    { icon: Send, title: 'Telegram', desc: settings.telegram_url ? 'Quick updates and discussion.' : 'Coming soon.', href: settings.telegram_url || undefined },
  ]

  return (
    <section className="pt-36 pb-28">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Community</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-14 max-w-xl">Join the Monad Africa Community</h1>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-20">
          {channels.map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              {c.href ? (
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="block rounded-squircle border border-white/10 bg-white/[0.02] p-7 h-full hover:border-purple/40 hover:-translate-y-1 transition-all">
                  <c.icon size={20} className="text-purple-light mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-1">{c.title}</h3>
                  <p className="text-white/50 text-sm">{c.desc}</p>
                </a>
              ) : (
                <div className="rounded-squircle border border-dashed border-white/15 p-7 h-full opacity-60">
                  <c.icon size={20} className="text-white/40 mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-1">{c.title}</h3>
                  <p className="text-white/50 text-sm">{c.desc}</p>
                </div>
              )}
            </Reveal>
          ))}
        </div>

        {events !== null && events.length > 0 && (
          <div className="mb-20">
            <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <h2 className="font-display font-semibold text-2xl flex items-center gap-2"><CalendarDays size={20} className="text-purple-light" /> Upcoming events</h2>
              <Link to="/events" className="text-sm font-semibold text-purple-light hover:text-white transition-colors">View all events →</Link>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {events.slice(0, 4).map((e, i) => (
                <Reveal key={e.id} delay={i * 50}>
                  <button onClick={() => openEvent(e)} className="w-full text-left flex items-center gap-4 rounded-squircle border border-white/10 bg-white/[0.02] p-5 hover:border-purple/40 transition-colors">
                    <OrganiserLogo name={e.organiser_name || 'Monad Africa'} logoUrl={e.organiser_logo_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-sm truncate">{e.title}</h3>
                      <p className="text-white/45 text-xs mt-1">{formatEventDate(e.event_date)}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {contributors !== null && contributors.length > 0 && (
          <div className="mb-20">
            <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <h2 className="font-display font-semibold text-2xl">Top contributors</h2>
              <Link to="/builders" className="text-sm font-semibold text-purple-light hover:text-white transition-colors">Meet all builders →</Link>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {contributors.map((c, i) => (
                <Reveal key={c.id} delay={i * 60}><BuilderCard builder={c} /></Reveal>
              ))}
            </div>
          </div>
        )}

        <Reveal className="mb-4">
          <h2 className="font-display font-semibold text-2xl">Monad Africa Community</h2>
        </Reveal>
        <Reveal className="mb-8">
          <CommunityStats settings={settings} />
        </Reveal>
        <Reveal className="mb-20">
          <p className="text-white/30 text-xs font-mono">
            Each count reflects the platform's own real data, synced on a schedule where the
            platform supports it — shown as "Manual" where it doesn't yet. Growth deltas are only
            ever calculated from real stored snapshots, never estimated.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-20">
          {[
            ['Countries Reached', settings.countries_reached],
            ['Builders Onboarded', settings.builders_onboarded],
            ['Community Partners', settings.community_partners],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-squircle border border-white/10 bg-gradient-to-b from-purple/10 to-transparent p-6 text-center">
              <div className="font-display font-semibold text-2xl"><Counter value={value as number} suffix="+" /></div>
              <div className="text-white/50 text-xs mt-2">{label}</div>
            </div>
          ))}
        </Reveal>

        <Reveal>
          <div className="rounded-squircle border border-white/10 bg-panel/40 p-10 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple/10 border border-purple/25 flex items-center justify-center">
                <CalendarDays size={20} className="text-purple-light" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-lg">Ambassador Program</h3>
                <p className="text-white/50 text-sm mt-1">Represent Monad Africa in your city — apply through Discord or Contact.</p>
              </div>
            </div>
            <a href={settings.discord_url} target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple text-sm">
              Learn More
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
