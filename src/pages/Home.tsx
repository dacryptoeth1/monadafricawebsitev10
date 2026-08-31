import { memo, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Handshake, Newspaper, Target, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Bounty, EcosystemProject, EventItem, NewsItem, Partner, PublicProfile, SiteContent, SiteSettings } from '../types'
import { defaultSiteSettings } from '../types'
import { useSiteSettings } from '../hooks/useSiteSettings'
import Reveal from '../components/Reveal'
import Counter from '../components/Counter'
import AfricaNetworkMap from '../components/AfricaNetworkMap'
import { KentePattern } from '../components/PatternBackground'
import BountyCard from '../components/BountyCard'
import EmptyState from '../components/EmptyState'
import MonadMark from '../components/MonadMark'

const defaultSiteContent: SiteContent = {
  hero_title: 'Building the Future of Monad in Africa.',
  hero_subtitle: 'Monad Africa connects builders, developers, students, creators, founders, and communities across the continent to real opportunities in the Monad ecosystem.',
  hero_primary_label: 'Explore Bounties',
  hero_primary_href: '/bounties',
  hero_secondary_label: 'Join Community',
  hero_secondary_href: 'discord',
  footer_text: '',
  roadmap_items: [],
  faq_items: [],
  updated_at: '',
}

export default function Home() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null)
  const settings = useSiteSettings()
  const [content, setContent] = useState<SiteContent>(defaultSiteContent)
  const [liveBountyCount, setLiveBountyCount] = useState(0)
  const [registeredUsers, setRegisteredUsers] = useState(0)
  const [completedBounties, setCompletedBounties] = useState(0)
  const [ecosystemProjects, setEcosystemProjects] = useState<EcosystemProject[] | null>(null)
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [news, setNews] = useState<NewsItem[] | null>(null)

  useEffect(() => {
    // Two lightweight queries instead of one: the homepage only ever
    // renders 3 bounty cards, so fetching every approved bounty's full
    // row (previously unbounded — every column, every row) just to
    // .slice(0, 3) client-side wasted bandwidth as the bounty board
    // grows. A separate head:true/count-only query gets the "N live
    // bounties" number without downloading any row data for it.
    supabase
      .from('bounties')
      .select('*')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setBounties((data as Bounty[]) ?? []))
    supabase
      .from('bounties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .then(({ count }) => setLiveBountyCount(count ?? 0))
  }, [])

  useEffect(() => {
    supabase.from('events').select('*').order('event_date', { ascending: true }).limit(3).then(({ data }) => setEvents((data as EventItem[]) ?? []))
    supabase.from('news').select('*').order('published_at', { ascending: false }).limit(3).then(({ data }) => setNews((data as NewsItem[]) ?? []))
  }, [])

  useEffect(() => {
    supabase
      .from('site_content')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setContent({ ...defaultSiteContent, ...(data as unknown as SiteContent) })
      })
  }, [])

  useEffect(() => {
    // profiles has no public SELECT policy (a row is only readable by
    // its own owner or an admin — see migration 0032's notes), so a
    // plain count(*)-via-select against it always returned 0 to a real
    // visitor. total_registered_users() is a SECURITY DEFINER RPC that
    // returns nothing but a number — no row data, no PII — specifically
    // so this stat can be public.
    supabase.rpc('total_registered_users').then(({ data }) => setRegisteredUsers(typeof data === 'number' ? data : 0))
    supabase.from('bounties').select('id', { count: 'exact', head: true }).eq('is_closed', true).eq('is_deleted', false).then(({ count }) => setCompletedBounties(count ?? 0))
  }, [])

  useEffect(() => {
    // One request instead of two: the featured carousel only ever needs
    // a filtered view of the same `projects` rows the logo grid below
    // already fetches in full (both order by created_at desc), so it's
    // derived client-side (see featuredProjects below) instead of
    // re-querying the same table with an extra is_featured=true filter.
    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => setEcosystemProjects((data as EcosystemProject[]) ?? []))
    supabase.from('partners').select('*').order('created_at', { ascending: false }).then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [])

  const featuredProjects = useMemo(
    () => (ecosystemProjects === null ? null : ecosystemProjects.filter((p) => p.is_featured)),
    [ecosystemProjects],
  )

  return (
    <>
      <Hero content={content} settings={settings} />
      <StatsStrip settings={settings} liveBountyCount={liveBountyCount} registeredUsers={registeredUsers} completedBounties={completedBounties} />
      <BountiesPreview bounties={bounties} settings={settings} />
      <EcosystemLogoGrid projects={ecosystemProjects} />
      <FeaturedProjectsCarousel projects={featuredProjects} />
      <PartnersSection partners={partners} />
      <EventsSection events={events} />
      <NewsSection news={news} />
      <RoadmapSection items={content.roadmap_items} />
      <FaqSection items={content.faq_items} />
      <LeaderboardPreview />
      <FeaturedContributors />
      <FinalCta />
    </>
  )
}

function renderHeroTitle(title: string) {
  // Keeps the existing visual design (gradient-highlighted "Monad") even
  // though the title text itself is now CMS-editable — splits on the
  // word "Monad" and wraps each occurrence in the same gradient span
  // the original hardcoded title used.
  const parts = title.split(/(Monad)/gi)
  return parts.map((part, i) =>
    part.toLowerCase() === 'monad' ? (
      <span key={i} className="bg-gradient-to-r from-sunset-amber via-purple-light to-purple bg-clip-text text-transparent">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function Hero({ content, settings }: { content: SiteContent; settings: SiteSettings }) {
  const secondaryHref =
    content.hero_secondary_href === 'discord' ? settings.discord_url : content.hero_secondary_href || settings.discord_url
  const secondaryIsExternal = secondaryHref.startsWith('http')

  return (
    <section className="relative min-h-[92vh] flex items-center pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-ink via-ink to-[#140a1e]" />
      <div className="absolute -z-10 w-[600px] h-[600px] rounded-full bg-purple-glow blur-[120px] opacity-40 top-[-200px] right-[-160px]" />
      <div className="absolute -z-10 w-[500px] h-[500px] rounded-full bg-sunset-coral blur-[130px] opacity-[0.18] bottom-[-200px] left-[-140px]" />
      <KentePattern className="absolute inset-0 -z-10 text-white opacity-[0.03]" />
      <AfricaNetworkMap className="absolute -z-10 w-[780px] max-w-[90vw] opacity-40 right-[-8%] top-1/2 -translate-y-1/2" />
      <img
        src="/brand/monad-logo-white.png"
        alt=""
        loading="lazy"
        aria-hidden="true"
        className="absolute -z-10 w-[900px] max-w-[130vw] opacity-[0.05] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
      />

      <div className="max-w-7xl mx-auto px-6 w-full">
        <div className="max-w-2xl">
          <Reveal>
            <div className="mb-6"><MonadMark size={36} /></div>
            <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-purple-light">
              <span className="w-1.5 h-1.5 rounded-sm bg-purple shadow-[0_0_10px_#8C79FF]" />
              The gateway to the Monad ecosystem
            </span>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="font-display font-semibold text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] tracking-tight mt-5 mb-6">
              {renderHeroTitle(content.hero_title)}
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg text-white/60 leading-relaxed max-w-xl mb-9">{content.hero_subtitle}</p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-wrap gap-4">
              <Link to={content.hero_primary_href || '/bounties'} className="px-7 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
                {content.hero_primary_label || 'Explore Bounties'} →
              </Link>
              {secondaryIsExternal ? (
                <a href={secondaryHref} target="_blank" rel="noopener noreferrer" className="px-7 py-4 rounded-full font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                  {content.hero_secondary_label || 'Join Community'}
                </a>
              ) : (
                <Link to={secondaryHref} className="px-7 py-4 rounded-full font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                  {content.hero_secondary_label || 'Join Community'}
                </Link>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function StatsStrip({
  settings,
  liveBountyCount,
  registeredUsers,
  completedBounties,
}: {
  settings: SiteSettings
  liveBountyCount: number
  registeredUsers: number
  completedBounties: number
}) {
  const stats = [
    { label: 'Community Members', value: settings.discord_members },
    { label: 'Registered Users', value: registeredUsers },
    { label: 'Active Builders', value: settings.builders_onboarded },
    { label: 'Live Bounties', value: liveBountyCount },
    { label: 'Completed Bounties', value: completedBounties },
    { label: 'Countries Represented', value: settings.countries_reached },
  ]
  return (
    <section className="py-20 border-y border-white/10 bg-panel/30">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="mb-8">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Live Stats</span>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
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

// Wrapped in memo: `bounties` and `settings` are each their own stable
// state slot in Home() (only change reference when that specific data
// actually arrives/updates), so this section doesn't need to re-render
// just because an unrelated sibling section's data changed.
const BountiesPreview = memo(function BountiesPreview({ bounties, settings }: { bounties: Bounty[] | null; settings: SiteSettings }) {
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
})

function EcosystemLogoGrid({ projects }: { projects: EcosystemProject[] | null }) {
  // Compact "as seen in" style logo band — distinct from the fuller
  // Ecosystem page (/ecosystem), which shows full cards with
  // descriptions. This is deliberately minimal: just logos, so it
  // never competes visually with the richer sections around it.
  return (
    <section className="py-24 border-y border-white/10 bg-panel/20">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="text-center mb-12">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Supported by the Monad Ecosystem</span>
        </Reveal>
        {projects === null ? (
          <div className="flex flex-wrap justify-center gap-6">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-center text-white/30 text-sm">Ecosystem projects will appear here as they're added.</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-5">
            {projects.map((p, i) => (
              <Reveal key={p.id} delay={Math.min(i, 10) * 40}>
                <EcosystemLogoTile project={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function EcosystemLogoTile({ project }: { project: EcosystemProject }) {
  const content = (
    <div className="group w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center overflow-hidden transition-all hover:-translate-y-1 hover:border-purple/40 hover:shadow-[0_0_30px_-8px_rgba(110,84,255,0.6)]">
      {project.logo_url ? (
        <img src={project.logo_url} alt={project.name} loading="lazy" className="w-12 h-12 object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
      ) : (
        <span className="font-display font-bold text-sm text-white/50 group-hover:text-white transition-colors">{project.name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
  return project.website ? (
    <a href={project.website} target="_blank" rel="noopener noreferrer" title={project.name}>{content}</a>
  ) : (
    <div title={project.name}>{content}</div>
  )
}

function FeaturedProjectsCarousel({ projects }: { projects: EcosystemProject[] | null }) {
  const scrollerRef = useState<HTMLDivElement | null>(null)
  const [ref, setRef] = scrollerRef

  function scrollBy(dir: 1 | -1) {
    ref?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }

  if (projects !== null && projects.length === 0) return null // no clutter from an empty carousel

  return (
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6 mb-10">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Featured projects</span>
            <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4">Built on Monad.</h2>
          </div>
          {projects !== null && projects.length > 3 && (
            <div className="flex gap-2">
              <button onClick={() => scrollBy(-1)} className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/5"><ChevronLeft size={16} /></button>
              <button onClick={() => scrollBy(1)} className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/5"><ChevronRight size={16} /></button>
            </div>
          )}
        </Reveal>

        {projects === null ? (
          <div className="flex gap-5 overflow-hidden">
            {[0, 1, 2].map((i) => <div key={i} className="w-80 h-56 shrink-0 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : (
          <div ref={setRef} className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2" style={{ scrollbarWidth: 'none' }}>
            {projects.map((p, i) => (
              <Reveal key={p.id} delay={i * 60} className="shrink-0 w-80 snap-start">
                <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0">
                      {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-sm">{p.name.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-base truncate">{p.name}</h3>
                      {p.category && <span className="text-[10px] font-mono uppercase text-purple-light">{p.category}</span>}
                    </div>
                  </div>
                  <p className="text-white/55 text-sm leading-relaxed flex-1">{p.description}</p>
                  {p.website && (
                    <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-purple-light hover:text-white transition-colors">
                      Visit <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function PartnersSection({ partners }: { partners: Partner[] | null }) {
  return (
    <section className="py-28 bg-panel/30">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Partners</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-12 max-w-xl">Building this ecosystem together.</h2>
        </Reveal>
        {partners === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : partners.length === 0 ? (
          <EmptyState Icon={Handshake} message="No community partners listed yet." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {partners.map((p, i) => (
              <Reveal key={p.id} delay={i * 50}>
                <a
                  href={p.website || '#'}
                  target={p.website ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 h-full hover:border-gold/40 hover:-translate-y-1 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-gradient-to-br from-purple-glow to-purple shrink-0">
                    {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-sm">{p.name.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <span className="text-sm font-medium text-center">{p.name}</span>
                </a>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

const EventsSection = memo(function EventsSection({ events }: { events: EventItem[] | null }) {
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
})

const NewsSection = memo(function NewsSection({ news }: { news: NewsItem[] | null }) {
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
})

// Wrapped in memo: takes no props and manages its own data internally,
// so it never needs to re-render just because an unrelated sibling
// section's state (bounties, events, news, ...) updated during Home's
// staggered initial data load — each of those is a separate top-level
// useState in Home(), and every one of them updating re-renders every
// section unless memoized like this.
const LeaderboardPreview = memo(function LeaderboardPreview() {
  const [top, setTop] = useState<PublicProfile[] | null>(null)

  useEffect(() => {
    // leaderboard_public (migration 0032), not profiles directly — see
    // that migration's notes for why a direct profiles query here
    // always returned 0 rows to a real, non-admin visitor.
    supabase.from('leaderboard_public').select('id, username, full_name, avatar_url, country, xp, total_referrals').order('xp', { ascending: false }).limit(5).then(({ data }) => setTop((data as PublicProfile[]) ?? []))
  }, [])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <section className="py-28 bg-panel/30">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal className="text-center mb-12">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Ranked by XP</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4">🏆 African Leaderboard</h2>
        </Reveal>

        {top === null ? (
          <div className="flex flex-col gap-2 max-w-lg mx-auto">
            {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : top.length === 0 ? (
          <EmptyState Icon={Users} message="No builders on the leaderboard yet — be the first to earn XP." />
        ) : (
          <Reveal className="flex flex-col gap-2 max-w-lg mx-auto">
            {top.map((u, i) => (
              <div key={u.id} className={`flex items-center gap-4 rounded-2xl border p-4 ${i < 3 ? 'border-gold/30 bg-gradient-to-r from-gold/10 to-transparent' : 'border-white/10 bg-white/[0.02]'}`}>
                <div className="w-8 text-center font-display font-semibold shrink-0">{i < 3 ? medals[i] : i + 1}</div>
                <div className="flex-1 min-w-0 text-sm font-medium truncate">{u.full_name || u.username || 'Unnamed'}</div>
                <div className="font-mono text-sm text-purple-light shrink-0">{u.xp} XP</div>
              </div>
            ))}
          </Reveal>
        )}

        <div className="text-center mt-8">
          <Link to="/leaderboard" className="text-sm font-semibold text-purple-light hover:text-white transition-colors">View full leaderboard →</Link>
        </div>
      </div>
    </section>
  )
})

const FeaturedContributors = memo(function FeaturedContributors() {
  const [top, setTop] = useState<PublicProfile[] | null>(null)

  useEffect(() => {
    supabase.from('leaderboard_public').select('id, username, full_name, avatar_url, country, xp, total_referrals').gt('total_referrals', 0).order('total_referrals', { ascending: false }).limit(6).then(({ data }) => setTop((data as PublicProfile[]) ?? []))
  }, [])

  return (
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Featured contributors</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-12 max-w-xl">The people behind the ecosystem.</h2>
        </Reveal>
        {top === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : top.length === 0 ? (
          <EmptyState Icon={Users} message="No featured contributors yet — this fills in automatically as builders refer others and earn XP." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {top.map((u, i) => (
              <Reveal key={u.id} delay={i * 50}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center hover:border-purple/30 hover:-translate-y-1 transition-all">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden text-sm font-bold mb-3">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (u.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-sm font-medium truncate">{u.full_name || u.username}</div>
                  <div className="text-white/40 text-xs mt-1">{u.total_referrals} referrals</div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
})

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

function RoadmapSection({ items }: { items: SiteContent['roadmap_items'] }) {
  if (!items || items.length === 0) return null

  const statusStyles: Record<string, string> = {
    done: 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10',
    in_progress: 'text-amber-300 border-amber-300/30 bg-amber-300/10',
    planned: 'text-white/40 border-white/15',
  }
  const statusLabel: Record<string, string> = { done: 'Done', in_progress: 'In Progress', planned: 'Planned' }

  return (
    <section className="py-28 bg-panel/30">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Roadmap</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-12 max-w-xl">Where we're headed.</h2>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full">
                <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${statusStyles[item.status] || statusStyles.planned}`}>
                  {statusLabel[item.status] || 'Planned'}
                </span>
                <h3 className="font-display font-semibold text-lg mt-3 mb-2">{item.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{item.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqSection({ items }: { items: SiteContent['faq_items'] }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!items || items.length === 0) return null

  return (
    <section className="py-28">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">FAQ</span>
          <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-12">Questions, answered.</h2>
        </Reveal>
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 50}>
              <div className="rounded-squircle border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                >
                  <span className="font-medium text-sm">{item.question}</span>
                  <span className="text-white/40 text-lg shrink-0">{open === i ? '−' : '+'}</span>
                </button>
                {open === i && <div className="px-6 pb-5 text-white/55 text-sm leading-relaxed">{item.answer}</div>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
