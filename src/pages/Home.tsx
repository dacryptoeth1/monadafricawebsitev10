import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Newspaper, Target, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Bounty, EventItem, NewsItem, SiteSettings } from '../types'
import { defaultSiteSettings } from '../types'
import Reveal from '../components/Reveal'
import Counter from '../components/Counter'
import AfricaNetworkMap from '../components/AfricaNetworkMap'
import { KentePattern } from '../components/PatternBackground'
import BountyCard from '../components/BountyCard'
import EmptyState from '../components/EmptyState'

export default function Home() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)
  const [liveBountyCount, setLiveBountyCount] = useState(0)
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [news, setNews] = useState<NewsItem[] | null>(null)

  useEffect(() => {
    supabase
      .from('bounties')
      .select('*', { count: 'exact' })
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(({ data, count }) => {
        setBounties(((data as Bounty[]) ?? []).slice(0, 3))
        setLiveBountyCount(count ?? 0)
      })
  }, [])

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as SiteSettings)
      })
  }, [])

  useEffect(() => {
    supabase.from('events').select('*').order('event_date', { ascending: true }).limit(3).then(({ data }) => setEvents((data as EventItem[]) ?? []))
    supabase.from('news').select('*').order('published_at', { ascending: false }).limit(3).then(({ data }) => setNews((data as NewsItem[]) ?? []))
  }, [])

  return (
    <>
      <Hero />
      <StatsStrip settings={settings} liveBountyCount={liveBountyCount} />
      <BountiesPreview bounties={bounties} settings={settings} />
      <EventsSection events={events} />
      <NewsSection news={news} />
      <FeaturedBuilders />
      <FinalCta />
    </>
  )
}

function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-ink via-ink to-[#140a1e]" />
      <div className="absolute -z-10 w-[600px] h-[600px] rounded-full bg-purple-glow blur-[120px] opacity-40 top-[-200px] right-[-160px]" />
      <div className="absolute -z-10 w-[500px] h-[500px] rounded-full bg-sunset-coral blur-[130px] opacity-[0.18] bottom-[-200px] left-[-140px]" />
      <KentePattern className="absolute inset-0 -z-10 text-white opacity-[0.03]" />
      <AfricaNetworkMap className="absolute -z-10 w-[780px] max-w-[90vw] opacity-40 right-[-8%] top-1/2 -translate-y-1/2" />

      <div className="max-w-7xl mx-auto px-6 w-full">
        <div className="max-w-2xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-purple-light">
              <span className="w-1.5 h-1.5 rounded-sm bg-purple shadow-[0_0_10px_#8C79FF]" />
              The gateway to the Monad ecosystem
            </span>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="font-display font-semibold text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] tracking-tight mt-5 mb-6">
              Building the Future of{' '}
              <span className="bg-gradient-to-r from-sunset-amber via-purple-light to-purple bg-clip-text text-transparent">Monad</span> in Africa.
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg text-white/60 leading-relaxed max-w-xl mb-9">
              Monad Africa connects builders, developers, students, creators, founders, and
              communities across the continent to real opportunities in the Monad ecosystem.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-wrap gap-4">
              <Link to="/bounties" className="px-7 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
                Explore Bounties →
              </Link>
              <a href={defaultSiteSettings.discord_url} target="_blank" rel="noopener noreferrer" className="px-7 py-4 rounded-full font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                Join Community
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function StatsStrip({ settings, liveBountyCount }: { settings: SiteSettings; liveBountyCount: number }) {
  const stats = [
    { label: 'Community Members', value: settings.discord_members },
    { label: 'Active Builders', value: settings.builders_onboarded },
    { label: 'Live Bounties', value: liveBountyCount },
    { label: 'Countries Represented', value: settings.countries_reached },
  ]
  return (
    <section className="py-20 border-y border-white/10 bg-panel/30">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="mb-8">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Live Stats</span>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 70}>
              <div className="text-center">
                <div className="font-display font-semibold text-3xl"><Counter value={s.value} suffix="+" /></div>
                <div className="text-white/50 text-xs mt-2">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function BountiesPreview({ bounties, settings }: { bounties: Bounty[] | null; settings: SiteSettings }) {
  return (
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Featured bounties</span>
            <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4">Real work, real rewards.</h2>
          </div>
          <Link to="/bounties" className="text-sm font-semibold text-purple-light hover:text-white transition-colors">View all bounties →</Link>
        </Reveal>

        {bounties === null ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : bounties.length === 0 ? (
          <div className="grid grid-cols-1">
            <EmptyState
              Icon={Target}
              message={'No active bounties yet.\n\nJoin the Monad Africa community to get notified when new opportunities go live.'}
              actions={[
                { label: 'Join Telegram', href: settings.telegram_url, external: true },
                { label: 'Join Discord', href: settings.discord_url, external: true },
                { label: 'Follow on X', href: settings.x_url, external: true },
              ]}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {bounties.map((b, i) => (
              <Reveal key={b.id} delay={i * 80}><BountyCard bounty={b} /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function EventsSection({ events }: { events: EventItem[] | null }) {
  return (
    <section className="py-28 bg-panel/30">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Upcoming events</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-12 max-w-xl">Meetups, workshops, and Spaces.</h2>
        </Reveal>
        {events === null ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <EmptyState Icon={CalendarDays} message="No upcoming events right now — check back soon or follow our channels for announcements." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {events.map((e, i) => (
              <Reveal key={e.id} delay={i * 70}>
                <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full">
                  {e.event_type && <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{e.event_type}</span>}
                  <h3 className="font-display font-semibold text-lg mt-3 mb-1">{e.title}</h3>
                  {e.event_date && <p className="text-purple-light text-xs font-mono mb-2">{new Date(e.event_date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                  {e.description && <p className="text-white/55 text-sm leading-relaxed">{e.description}</p>}
                  {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-sm font-semibold text-purple-light hover:text-white">Details →</a>}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function NewsSection({ news }: { news: NewsItem[] | null }) {
  return (
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Latest ecosystem news</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-12 max-w-xl">What's happening on Monad.</h2>
        </Reveal>
        {news === null ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : news.length === 0 ? (
          <EmptyState Icon={Newspaper} message="No news posted yet — ecosystem updates will show up here as the Monad Africa team publishes them." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {news.map((n, i) => (
              <Reveal key={n.id} delay={i * 70}>
                <a href={n.link || '#'} target={n.link ? '_blank' : undefined} rel="noopener noreferrer" className="block rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full hover:border-gold/40 hover:-translate-y-1 transition-all">
                  <h3 className="font-display font-semibold text-lg mb-2">{n.title}</h3>
                  {n.summary && <p className="text-white/55 text-sm leading-relaxed">{n.summary}</p>}
                  <p className="text-white/30 text-xs font-mono mt-3">{new Date(n.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </a>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function FeaturedBuilders() {
  // No public builder-profile system exists yet in this build (not part of
  // the current schema), so this is an honest empty state rather than
  // invented names/photos. Wire this up to a `builders` table the same way
  // `projects`/`partners` work whenever you want to add it.
  return (
    <section className="py-28 bg-panel/30">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Featured builders</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-12 max-w-xl">The people behind the ecosystem.</h2>
        </Reveal>
        <EmptyState Icon={Users} message="No featured builders yet — this section highlights real African builders, developers, and creators as they're added by the Monad Africa team." />
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="py-28">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal>
          <div className="relative rounded-[40px] border border-white/10 bg-gradient-to-br from-panel to-ink p-14 md:p-20 text-center overflow-hidden">
            <div className="absolute -z-10 w-[500px] h-[500px] bg-sunset rounded-full blur-[100px] opacity-20 -top-40 left-1/2 -translate-x-1/2" />
            <h2 className="font-display font-semibold text-3xl md:text-5xl mb-5">Ready to build with us?</h2>
            <p className="text-white/60 max-w-lg mx-auto mb-9 leading-relaxed">
              Whether you're a project looking to reach African builders, or a builder looking
              for your next opportunity — this is where it starts.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/host-bounty" className="px-7 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">Host a Bounty →</Link>
              <a href={defaultSiteSettings.discord_url} target="_blank" rel="noopener noreferrer" className="px-7 py-4 rounded-full font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">Join Discord</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
