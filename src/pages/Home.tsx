import { memo, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, MapPin, MessageCircle, Send, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Bounty, EcosystemActivity, EcosystemProject, EventListing, Partner, SiteContent, SiteSettings, TeamMember } from '../types'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { formatEventDate } from '../lib/eventStatus'
import { freshnessLabel } from '../lib/ecosystemActivity'
import Reveal from '../components/Reveal'
import Counter from '../components/Counter'
import AfricaNetworkMap from '../components/AfricaNetworkMap'
import { KentePattern } from '../components/PatternBackground'
import BountyCard from '../components/BountyCard'
import TeamMemberCard from '../components/TeamMemberCard'
import EmptyState from '../components/EmptyState'
import MonadMark from '../components/MonadMark'
import CommunityStats from '../components/CommunityStats'
import { OrganiserLogo } from '../components/EventCard'

// The homepage's entire flow mirrors the site's five-pillar information
// architecture (nav: Explore / Team / Opportunities / Community /
// Partners — see Layout.tsx): Hero -> Explore -> Team -> Opportunities
// -> Community -> final CTA. Each preview section here is intentionally
// small and links out to its own dedicated page (/explore, /team,
// /bounties, /community) for the full experience, rather than trying
// to fit everything on one crowded page. Team shows the curated
// official Monad Africa roster (team_members) — not the wider
// community leaderboard directory, which still lives at /builders.
const defaultSiteContent: SiteContent = {
  hero_title: 'Africa is building on Monad.',
  hero_subtitle: 'Discover the people, projects and opportunities shaping the Monad ecosystem across Africa.',
  hero_primary_label: 'Explore the Ecosystem',
  hero_primary_href: '/explore',
  hero_secondary_label: 'Join the Community',
  hero_secondary_href: '/community',
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
  const [projectCount, setProjectCount] = useState(0)
  const [ecosystemProjects, setEcosystemProjects] = useState<EcosystemProject[] | null>(null)
  const [partners, setPartners] = useState<Partner[] | null>(null)
  const [events, setEvents] = useState<EventListing[] | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[] | null>(null)
  const [activity, setActivity] = useState<EcosystemActivity[] | null>(null)

  useEffect(() => {
    // Featured first, then newest — the homepage only ever shows 4, so
    // anything an admin has marked is_featured surfaces before it.
    supabase
      .from('bounties')
      .select('*')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setBounties((data as Bounty[]) ?? []))
    supabase
      .from('bounties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .then(({ count }) => setLiveBountyCount(count ?? 0))
  }, [])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(9)
      .then(({ data }) => setEvents((data as EventListing[]) ?? []))

    supabase
      .from('ecosystem_activity')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setActivity((data as EcosystemActivity[]) ?? []))
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
    supabase.from('projects').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).then(({ data }) => setEcosystemProjects((data as EcosystemProject[]) ?? []))
    supabase.from('projects').select('id', { count: 'exact', head: true }).then(({ count }) => setProjectCount(count ?? 0))
    supabase.from('partners').select('*').order('created_at', { ascending: false }).then(({ data }) => setPartners((data as Partner[]) ?? []))
    supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(4)
      .then(({ data }) => setTeamMembers((data as TeamMember[]) ?? []))
  }, [])

  return (
    <>
      <Hero content={content} settings={settings} liveBountyCount={liveBountyCount} projectCount={projectCount} />
      <ExplorePreview projects={ecosystemProjects} partners={partners} />
      <TeamPreview members={teamMembers} />
      <EcosystemActivityPreview activity={activity} />
      <OpportunitiesPreview bounties={bounties} settings={settings} />
      <CommunityPreview events={events} settings={settings} />
      <FinalCta settings={settings} />
    </>
  )
}

function renderHeroTitle(title: string) {
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

// Small reusable "kicker + title (+ optional subtitle) + optional
// right-aligned link" header used to open every section below — kept
// consistent so the page reads as one coherent editorial layout rather
// than a set of differently-styled blocks stitched together.
function SectionIntro({
  kicker,
  title,
  subtitle,
  cta,
}: {
  kicker: string
  title: string
  subtitle?: string
  cta?: { label: string; to: string }
}) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-6 mb-12">
      <div className="max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-wider text-purple-light">{kicker}</span>
        <h2 className="font-display font-semibold text-4xl md:text-5xl mt-4">{title}</h2>
        {subtitle && <p className="text-white/55 leading-relaxed mt-4 max-w-xl">{subtitle}</p>}
      </div>
      {cta && (
        <Link to={cta.to} className="text-sm font-semibold text-purple-light hover:text-white transition-colors shrink-0">
          {cta.label} →
        </Link>
      )}
    </Reveal>
  )
}

// Wrapped in memo: content/settings/liveBountyCount/projectCount are
// each their own stable state slot in Home() — this section shouldn't
// re-render just because an unrelated sibling's data (events, builders,
// ...) arrived.
const Hero = memo(function Hero({
  content,
  settings,
  liveBountyCount,
  projectCount,
}: {
  content: SiteContent
  settings: SiteSettings
  liveBountyCount: number
  projectCount: number
}) {
  const { session } = useAuth()
  const primaryHref = content.hero_primary_href || '/explore'
  const primaryLabel = content.hero_primary_label || 'Explore the Ecosystem'
  const primaryExternal = primaryHref.startsWith('http')

  const secondaryHref = content.hero_secondary_href === 'discord' ? settings.discord_url : content.hero_secondary_href || '/community'
  const secondaryLabel = content.hero_secondary_label || 'Join the Community'
  const secondaryExternal = secondaryHref.startsWith('http')

  const stats = [
    { label: 'Builders', value: settings.builders_onboarded },
    { label: 'Projects', value: projectCount },
    { label: 'Opportunities', value: liveBountyCount },
    { label: 'Countries', value: settings.countries_reached },
  ]

  return (
    <section className="relative min-h-[92vh] flex items-center pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-ink via-ink to-[#140a1e]" />
      <div className="absolute -z-10 w-[600px] h-[600px] rounded-full bg-purple-glow blur-[120px] opacity-40 top-[-200px] right-[-160px]" />
      <div className="absolute -z-10 w-[500px] h-[500px] rounded-full bg-sunset-coral blur-[130px] opacity-[0.18] bottom-[-200px] left-[-140px]" />
      <KentePattern className="absolute inset-0 -z-10 text-white opacity-[0.03]" />

      {/* The real Monad Africa "Africa network map" reference asset —
          not a redrawn illustration. hue-rotate nudges its warm
          amber/gold linework toward Monad purple while keeping the real
          artwork recognizable; a radial mask fades its rectangular
          edges into the background. Eager-loaded (above the fold) but
          small (~50KB) and non-blocking. */}
      <div
        className="absolute -z-10 right-[-6%] top-1/2 -translate-y-1/2 w-[620px] max-w-[85vw] opacity-40 pointer-events-none select-none"
        style={{ filter: 'hue-rotate(200deg) saturate(1.3) brightness(0.95)' }}
      >
        <img
          src="/brand/africa-network-map.jpg"
          alt=""
          aria-hidden="true"
          width={720}
          height={489}
          className="w-full h-auto rounded-[32px]"
          style={{
            maskImage: 'radial-gradient(ellipse at center, black 55%, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 55%, transparent 85%)',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 w-full">
        <div className="max-w-2xl">
          <Reveal>
            <div className="mb-6"><MonadMark size={36} /></div>
            <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-purple-light">
              <span className="w-1.5 h-1.5 rounded-sm bg-purple shadow-[0_0_10px_#8C79FF]" />
              Welcome to Monad Africa
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
            <div className="flex flex-wrap items-center gap-4 mb-4">
              {primaryExternal ? (
                <a href={primaryHref} target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-full font-semibold text-center bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
                  {primaryLabel} →
                </a>
              ) : (
                <Link to={primaryHref} className="px-8 py-4 rounded-full font-semibold text-center bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
                  {primaryLabel} →
                </Link>
              )}
              {secondaryExternal ? (
                <a href={secondaryHref} target="_blank" rel="noopener noreferrer" className="px-8 py-4 rounded-full font-semibold text-center border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                  {secondaryLabel}
                </a>
              ) : (
                <Link to={secondaryHref} className="px-8 py-4 rounded-full font-semibold text-center border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                  {secondaryLabel}
                </Link>
              )}
            </div>
          </Reveal>

          {/* Smaller, visually secondary — sits under the two primary
              buttons rather than beside them. Reuses the existing
              signup/auth flow (no second auth system): signed-out
              visitors go to /signup, someone already signed in goes
              straight to their dashboard instead of being asked to
              sign up again. */}
          <Reveal delay={350}>
            <Link to={session ? '/dashboard' : '/signup'} className="inline-block text-sm font-semibold text-white/50 hover:text-white transition-colors mb-14">
              {session ? 'Go to Dashboard' : 'Get Started'} →
            </Link>
          </Reveal>

          <Reveal delay={400}>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-display font-semibold text-2xl"><Counter value={s.value} suffix="+" /></div>
                  <div className="text-white/45 text-xs mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
})

// "Explore" — the first pillar. Real ecosystem projects + partner logos
// (same tables the full /explore and /ecosystem pages read), kept here
// as compact logo bands rather than duplicating the fuller cards —
// merely a taste of the ecosystem, not another dashboard.
const ExplorePreview = memo(function ExplorePreview({ projects, partners }: { projects: EcosystemProject[] | null; partners: Partner[] | null }) {
  const hasProjects = projects === null || projects.length > 0
  const hasPartners = partners === null || partners.length > 0
  if (!hasProjects && !hasPartners) return null // no clutter from an empty section

  return (
    <section className="py-28 relative overflow-hidden">
      <AfricaNetworkMap className="absolute -z-10 w-[600px] max-w-[80vw] opacity-[0.06] left-[-10%] top-1/2 -translate-y-1/2" />
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro
          kicker="Explore"
          title="Discover the ecosystem across Africa."
          subtitle="Projects building on Monad, and the partners supporting them — from Lagos to Nairobi to Cape Town."
          cta={{ label: 'Explore the ecosystem', to: '/explore' }}
        />

        {hasProjects && (
          <div className="mb-16">
            <span className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-6">Projects building on Monad</span>
            {projects === null ? (
              <div className="flex flex-wrap gap-5">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
              </div>
            ) : (
              <div className="flex flex-wrap gap-5">
                {projects.map((p, i) => (
                  <Reveal key={p.id} delay={Math.min(i, 10) * 40}>
                    <LogoTile name={p.name} logoUrl={p.logo_url} website={p.website} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}

        {hasPartners && (
          <div>
            <span className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-6">Community partners</span>
            {partners === null ? (
              <div className="flex flex-wrap gap-5">
                {[0, 1, 2, 3].map((i) => <div key={i} className="w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
              </div>
            ) : (
              <div className="flex flex-wrap gap-5">
                {partners.map((p, i) => (
                  <Reveal key={p.id} delay={Math.min(i, 10) * 40}>
                    <LogoTile name={p.name} logoUrl={p.logo_url} website={p.website} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
})

function LogoTile({ name, logoUrl, website }: { name: string; logoUrl: string | null; website: string | null }) {
  const content = (
    <div className="group w-24 h-24 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center overflow-hidden transition-all hover:-translate-y-1 hover:border-purple/40 hover:shadow-[0_0_30px_-8px_rgba(110,84,255,0.6)]">
      {logoUrl ? (
        <img src={logoUrl} alt={name} loading="lazy" className="w-12 h-12 object-contain grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
      ) : (
        <span className="font-display font-bold text-sm text-white/50 group-hover:text-white transition-colors">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
  return website ? (
    <a href={website} target="_blank" rel="noopener noreferrer" title={name}>{content}</a>
  ) : (
    <div title={name}>{content}</div>
  )
}

// "Team" — the curated, official Monad Africa roster (team_members),
// deliberately NOT the wider community leaderboard directory (that's
// /builders — still a live page, just no longer what this section or
// the nav's "Team" label point to). Reuses TeamMemberCard as-is, same
// component /team itself uses, so the visual treatment matches exactly.
const TeamPreview = memo(function TeamPreview({ members }: { members: TeamMember[] | null }) {
  if (members !== null && members.length === 0) return null // no clutter from an empty section

  return (
    <section className="py-28 bg-panel/30 border-y border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro
          kicker="Team"
          title="Meet the builders behind Monad Africa."
          subtitle="The people building and running Monad Africa across the continent."
          cta={{ label: 'Meet the team', to: '/team' }}
        />

        {members === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[0, 1].map((i) => <div key={i} className="h-64 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {members.map((m, i) => (
              <Reveal key={m.id} delay={i * 60}><TeamMemberCard member={m} highlight={m.is_bd_lead} /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
})

// A tasteful teaser of /events' "ecosystem intelligence" feed — real
// rows from ecosystem_activity (migration 0043), each with a genuine
// freshness label (never a blanket "Live" unless it actually is one).
// Deliberately NOT a duplicate of the Events page: just the 3 most
// recent published entries, linking out for the full feed + Africa map.
const EcosystemActivityPreview = memo(function EcosystemActivityPreview({ activity }: { activity: EcosystemActivity[] | null }) {
  if (activity !== null && activity.length === 0) return null // no clutter from an empty section

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro
          kicker="Ecosystem pulse"
          title="Latest ecosystem activity."
          subtitle="What's happening across Monad right now — globally and across Africa."
          cta={{ label: 'View all events', to: '/events' }}
        />

        {activity === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {activity.map((item, i) => (
              <Reveal key={item.id} delay={i * 60}>
                <Link to="/events" className="block rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full hover:border-purple/40 hover:-translate-y-1 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{item.status}</span>
                    {item.category && <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/40">{item.category}</span>}
                  </div>
                  <h3 className="font-display font-semibold text-base mb-2 leading-snug">{item.title}</h3>
                  {item.statistic_value ? (
                    <div className="font-display font-semibold text-xl text-purple-light">{item.statistic_value}</div>
                  ) : (
                    item.description && <p className="text-white/50 text-sm leading-relaxed line-clamp-2">{item.description}</p>
                  )}
                  <div className="text-white/35 text-[11px] font-mono mt-4">{freshnessLabel(item)}</div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
})

// "Opportunities" — the third pillar. Real bounties, single-column list
// rows (Superteam Earn-style, not a card grid) — same BountyCard the
// full /bounties page uses, so the apply/credit flow can't drift.
const OpportunitiesPreview = memo(function OpportunitiesPreview({ bounties, settings }: { bounties: Bounty[] | null; settings: SiteSettings }) {
  return (
    <section className="py-28">
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro
          kicker="Opportunities"
          title="Real work, real rewards."
          subtitle="Bounties, grants, and paid work from projects building on Monad — reviewed and approved by the Monad Africa team before they go live."
          cta={{ label: 'View all opportunities', to: '/opportunities' }}
        />

        {bounties === null ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : bounties.length === 0 ? (
          <EmptyState
            Icon={Target}
            message={'No active opportunities yet.\n\nJoin the Monad Africa community to get notified when new opportunities go live.'}
            actions={[
              { label: 'Join Telegram', href: settings.telegram_url, external: true },
              { label: 'Join Discord', href: settings.discord_url, external: true },
              { label: 'Follow on X', href: settings.x_url, external: true },
            ]}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {bounties.map((b, i) => (
              <Reveal key={b.id} delay={i * 60}><BountyCard bounty={b} variant="row" /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
})

function UpcomingEventTeaser({ event, onOpen }: { event: EventListing; onOpen: () => void }) {
  const organiser = event.organiser_name || 'Monad Africa'
  const isOnline = (event.location || '').toLowerCase().includes('online') || (event.location || '').toLowerCase().includes('virtual')

  return (
    <button onClick={onOpen} className="group text-left rounded-squircle border border-white/10 bg-white/[0.02] p-6 flex flex-col gap-4 h-full hover:border-purple/40 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-2.5">
        <OrganiserLogo name={organiser} logoUrl={event.organiser_logo_url} size={32} />
        <span className="text-xs text-white/45 truncate">{organiser}</span>
      </div>
      <h3 className="font-display font-semibold text-lg leading-snug">{event.title}</h3>
      <div className="mt-auto pt-2 flex flex-col gap-1.5 text-xs text-white/50">
        <div className="flex items-center gap-2">
          <CalendarDays size={13} className="text-purple-light shrink-0" />
          {formatEventDate(event.event_date)}
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-purple-light shrink-0" />
            <span className="truncate">{isOnline ? 'Online' : event.location}</span>
          </div>
        )}
      </div>
      <span className="text-sm font-semibold text-purple-light group-hover:text-white transition-colors">View event →</span>
    </button>
  )
}

// "Community" — the fourth pillar. Real upcoming events plus the actual
// community channels (Discord/X/Telegram, from site_settings) — a
// preview of what /community shows in full.
const CommunityPreview = memo(function CommunityPreview({ events, settings }: { events: EventListing[] | null; settings: SiteSettings }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const upcoming = useMemo(() => (events ?? []).slice(0, 2), [events])

  function openEvent(event: EventListing) {
    if (!session) {
      navigate('/login', { state: { from: '/events', eventId: event.id } })
      return
    }
    navigate('/events', { state: { openEventId: event.id } })
  }

  const channels = [
    { icon: MessageCircle, label: 'Discord', href: settings.discord_url },
    { icon: Send, label: 'Telegram', href: settings.telegram_url },
    { icon: null, label: 'X (Twitter)', href: settings.x_url },
  ].filter((c) => !!c.href)

  return (
    <section className="py-28 bg-panel/30 border-y border-white/10">
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro
          kicker="Community"
          title="Connect, learn, and grow together."
          subtitle="Events, meetups, and the channels where African builders and community members find each other."
          cta={{ label: 'Visit the community', to: '/community' }}
        />

        {upcoming.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
            {upcoming.map((e, i) => (
              <Reveal key={e.id} delay={i * 60}>
                <UpcomingEventTeaser event={e} onOpen={() => openEvent(e)} />
              </Reveal>
            ))}
          </div>
        )}

        <Reveal className="flex flex-wrap gap-3 mb-10">
          {channels.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
            >
              {c.icon ? <c.icon size={15} className="text-purple-light" /> : <span className="text-purple-light text-xs font-bold">𝕏</span>}
              {c.label}
            </a>
          ))}
        </Reveal>

        <Reveal>
          <span className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Monad Africa community</span>
          <CommunityStats settings={settings} compact />
        </Reveal>
      </div>
    </section>
  )
})

function FinalCta({ settings }: { settings: SiteSettings }) {
  return (
    <section className="py-28">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal>
          <div className="relative rounded-[40px] border border-white/10 bg-gradient-to-br from-panel to-ink p-14 md:p-20 text-center overflow-hidden">
            <div className="absolute -z-10 w-[500px] h-[500px] bg-sunset rounded-full blur-[100px] opacity-20 -top-40 left-1/2 -translate-x-1/2" />
            <h2 className="font-display font-semibold text-3xl md:text-5xl mb-5">Africa is building. Find your place.</h2>
            <p className="text-white/60 max-w-lg mx-auto mb-9 leading-relaxed">
              Join thousands of builders, creators and contributors shaping the future of Monad
              — wherever you are on the continent.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mb-8">
              <Link to="/signup" className="px-7 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
                Join Monad Africa →
              </Link>
              <Link to="/community" className="px-7 py-4 rounded-full font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                Join the Community
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm">
              <Link to="/host-bounty" className="text-white/50 hover:text-white transition-colors">Have an opportunity to host? →</Link>
              <Link to="/partner" className="text-white/50 hover:text-white transition-colors">Partner with Monad Africa →</Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
