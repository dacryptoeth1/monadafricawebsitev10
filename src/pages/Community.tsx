import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarDays, MessageCircle, Mic, Send, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { formatEventDate } from '../lib/eventStatus'
import type { CommunityStory, EventListing, PublicProfile } from '../types'
import Reveal from '../components/Reveal'
import Counter from '../components/Counter'
import BuilderCard from '../components/BuilderCard'
import CommunityStats from '../components/CommunityStats'
import CountryFlag from '../components/CountryFlag'
import { OrganiserLogo } from '../components/EventCard'

// The single Community experience. Monad Spaces and Community Stories
// are sections OF this page (#spaces / #stories) rather than separate
// routes — everything community-related opens inside the community
// aspect, which is what the marketing review asked for, and it means
// the homepage cards, the nav dropdown and the footer all land on the
// same place instead of three near-identical mini-pages.
//
// Real X/Discord/Telegram counts live in CommunityStats
// (community_stats table, migration 0044 — written only by
// scripts/sync-community-stats.mjs, run by GitHub Actions). That
// superseded this page's old client-side fetchDiscordWidget() call,
// which only ever surfaced Discord's *online presence* count, not a
// true member total.
export default function Community() {
  const settings = useSiteSettings()
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [events, setEvents] = useState<EventListing[] | null>(null)
  const [contributors, setContributors] = useState<PublicProfile[] | null>(null)
  const [stories, setStories] = useState<CommunityStory[] | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(12)
      .then(({ data }) => setEvents((data as EventListing[]) ?? []))

    supabase
      .from('leaderboard_public')
      .select('*')
      .order('xp', { ascending: false })
      .limit(3)
      .then(({ data }) => setContributors((data as PublicProfile[]) ?? []))

    // Migration 0049. If it hasn't been applied yet the query errors and
    // `data` is null — which lands in exactly the same place an empty
    // table does: the section's honest empty state.
    supabase
      .from('community_stories')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setStories((data as CommunityStory[]) ?? []))
  }, [])

  // ScrollToTop deliberately leaves hash navigation to the destination
  // page (see components/ScrollToTop.tsx), so /community#spaces and
  // /community#stories have to scroll themselves — and only once their
  // section has actually rendered, hence the data in the deps.
  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(location.hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, events, stories])

  function openEvent(event: EventListing) {
    if (!session) {
      navigate('/login', { state: { from: '/events', eventId: event.id } })
      return
    }
    navigate('/events', { state: { openEventId: event.id } })
  }

  // An X Space is a scheduled event, so Spaces reuse the existing
  // `events` table (and its admin tooling) rather than a second,
  // duplicate table — an event whose type mentions "Space" is one.
  const spaces = useMemo(() => (events ?? []).filter((e) => /space/i.test(e.event_type ?? '')), [events])
  const upcoming = useMemo(() => (events ?? []).filter((e) => !/space/i.test(e.event_type ?? '')), [events])

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
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-5 max-w-xl">Join the Monad Africa Community</h1>
          <p className="text-white/55 leading-relaxed max-w-xl mb-14">
            Events, weekly Spaces, builder stories, and the people shipping on Monad across the continent —
            all in one place.
          </p>
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

        {upcoming.length > 0 && (
          <div className="mb-20">
            <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <h2 className="font-display font-semibold text-2xl flex items-center gap-2"><CalendarDays size={20} className="text-purple-light" /> Upcoming events</h2>
              <Link to="/events" className="text-sm font-semibold text-purple-light hover:text-white transition-colors">View all events →</Link>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {upcoming.slice(0, 4).map((e, i) => (
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

        {/* ---------------- Monad Spaces ---------------- */}
        <div id="spaces" className="mb-20 scroll-mt-28">
          <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div className="max-w-xl">
              <h2 className="font-display font-semibold text-2xl flex items-center gap-2"><Mic size={20} className="text-purple-light" /> Monad Spaces</h2>
              <p className="text-white/55 text-sm leading-relaxed mt-3">
                Weekly X Spaces with builders, founders and ecosystem leaders — live conversations about
                what's being built on Monad across Africa.
              </p>
            </div>
            {settings.x_url && (
              <a href={settings.x_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-purple-light hover:text-white transition-colors shrink-0">
                Follow on X for the next Space →
              </a>
            )}
          </Reveal>

          {events === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[0, 1].map((i) => <div key={i} className="h-24 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : spaces.length === 0 ? (
            // Deliberately not an invented schedule: Spaces show up here
            // as soon as one is published as an event whose type says
            // "Space" (Admin → Events), and until then this points at
            // the real place they're announced.
            <div className="rounded-squircle border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
              <Mic size={22} className="text-purple-light mx-auto mb-4" />
              <p className="text-white/55 text-sm max-w-md mx-auto leading-relaxed mb-6">
                No Space scheduled at the moment. Spaces are announced on X and in Discord first, and
                appear here as soon as the next one is on the calendar.
              </p>
              <div className="flex flex-wrap gap-3 justify-center text-sm font-semibold">
                {settings.x_url && (
                  <a href={settings.x_url} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                    Follow on X
                  </a>
                )}
                {settings.discord_url && (
                  <a href={settings.discord_url} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                    Join Discord
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {spaces.map((e, i) => (
                <Reveal key={e.id} delay={i * 50}>
                  <button onClick={() => openEvent(e)} className="w-full text-left flex items-center gap-4 rounded-squircle border border-white/10 bg-white/[0.02] p-5 hover:border-purple/40 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-purple/15 text-purple-light flex items-center justify-center shrink-0"><Mic size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-sm truncate">{e.title}</h3>
                      <p className="text-white/45 text-xs mt-1">{formatEventDate(e.event_date)}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          )}
        </div>

        {/* ---------------- Community Stories ---------------- */}
        <div id="stories" className="mb-20 scroll-mt-28">
          <Reveal className="mb-6 max-w-xl">
            <h2 className="font-display font-semibold text-2xl flex items-center gap-2"><BookOpen size={20} className="text-purple-light" /> Community Stories</h2>
            <p className="text-white/55 text-sm leading-relaxed mt-3">
              What builders across Africa are shipping on Monad, in their own words.
            </p>
          </Reveal>

          {stories === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-squircle border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
              <BookOpen size={22} className="text-purple-light mx-auto mb-4" />
              <p className="text-white/55 text-sm max-w-md mx-auto leading-relaxed mb-6">
                The first community stories are being written. If you're building on Monad in Africa and
                want your story told, tell us about it.
              </p>
              <Link to="/contact" className="inline-flex px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                Share your story
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {stories.map((story, i) => (
                <Reveal key={story.id} delay={i * 50}><StoryCard story={story} /></Reveal>
              ))}
            </div>
          )}
        </div>

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

// A story with an external `link` opens it; one without is self-
// contained (its excerpt is the story), so it renders as a plain card
// rather than a link that goes nowhere.
function StoryCard({ story }: { story: CommunityStory }) {
  const inner = (
    <>
      {story.cover_image_url && (
        <img src={story.cover_image_url} alt="" loading="lazy" className="w-full h-32 object-cover rounded-xl mb-4" />
      )}
      <h3 className="font-display font-semibold text-base mb-2 leading-snug line-clamp-2">{story.title}</h3>
      {story.excerpt && <p className="text-white/50 text-sm leading-relaxed line-clamp-3">{story.excerpt}</p>}
      <div className="flex items-center gap-2.5 mt-auto pt-4 border-t border-white/10">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[9px] font-display font-bold">
          {story.author_avatar_url ? (
            <img src={story.author_avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            (story.author_name || 'M').slice(0, 1).toUpperCase()
          )}
        </div>
        <span className="text-white/60 text-xs truncate flex-1 min-w-0">{story.author_name || 'Monad Africa'}</span>
        {story.author_country && <CountryFlag country={story.author_country} size={11} />}
      </div>
    </>
  )

  const className = 'rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full flex flex-col'

  return story.link ? (
    <a href={story.link} target="_blank" rel="noopener noreferrer" className={`${className} hover:border-purple/40 hover:-translate-y-1 transition-all`}>
      {inner}
    </a>
  ) : (
    <div className={className}>{inner}</div>
  )
}
