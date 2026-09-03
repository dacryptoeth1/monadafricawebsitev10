import { memo, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Boxes, CalendarDays, Globe2, Megaphone, MessageCircle, Radio, Send, Sparkles, Target, Trophy, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Bounty, EcosystemActivity, EcosystemProject, EventListing, PublicProfile, SiteContent, SiteSettings, TeamMember } from '../types'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { formatEventDate } from '../lib/eventStatus'
import { freshnessLabel } from '../lib/ecosystemActivity'
import { flagFor } from '../lib/countryFlag'
import { positionFor } from '../lib/africaGeo'
import Reveal from '../components/Reveal'
import Counter from '../components/Counter'
import AfricaNetworkMap, { type MapNode } from '../components/AfricaNetworkMap'
import { KentePattern } from '../components/PatternBackground'
import { TeamMemberRow } from '../components/TeamMemberCard'
import MonadMark from '../components/MonadMark'
import CommunityStats from '../components/CommunityStats'

// Redesigned around a reference layout the user supplied
// (references/interface.jpeg): dense, card-based, Africa-map-centric —
// Hero -> Live Ecosystem -> 3-column Discovery (Opportunities / Team /
// Projects) -> Explore Africa -> Community -> final CTA. Every section
// still reads from the exact same tables/queries the rest of the site
// already uses (bounties, ecosystem_activity, team_members, projects,
// leaderboard_public, community_stats, events) — this is a
// re-composition of real data, not a new backend.
// Applied to every below-the-fold section: `content-visibility: auto`
// tells the browser to skip layout/style/paint work for a subtree
// until it's near the viewport — real, measured browser support across
// mobile Chrome/Safari/Firefox, and a no-op (falls back to normal
// rendering) anywhere it isn't supported, so this can't make anything
// worse. `contain-intrinsic-size` reserves an approximate height
// up front so the page doesn't jump when a section's real content
// replaces the placeholder on first reveal — the `auto` keyword lets
// the browser remember and reuse the section's *actual* height after
// that first reveal, so any estimation error only ever costs one
// approximate frame per section per page load, not a repeat gap.
function SKIP_OFFSCREEN_WORK(estimatedHeight: string): React.CSSProperties {
  return { contentVisibility: 'auto', containIntrinsicSize: `auto ${estimatedHeight}` }
}

// Runs `fn` once the browser is idle (after the current paint), instead
// of immediately alongside the Hero's own critical requests — every
// below-the-fold section already renders its own loading skeleton, so
// this only changes *when* their real data starts arriving, never
// whether it does. Safari has no requestIdleCallback, hence the
// setTimeout fallback; returns a canceller so unmounting mid-idle
// (fast navigation away) doesn't call setState on a gone component.
function deferIdle(fn: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void }
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn)
    return () => w.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 200)
  return () => window.clearTimeout(id)
}

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
  const [events, setEvents] = useState<EventListing[] | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[] | null>(null)
  const [activity, setActivity] = useState<EcosystemActivity[] | null>(null)
  const [countries, setCountries] = useState<{ name: string; count: number }[] | null>(null)
  const [topContributors, setTopContributors] = useState<PublicProfile[] | null>(null)

  // Only what the Hero (above the fold) actually renders is fetched
  // eagerly: the two counts feeding its stats row, and site_content for
  // the headline/copy/buttons. Everything else below the fold used to
  // fire all nine of these queries in parallel on every homepage visit,
  // immediately, competing with the Hero's own requests for the same
  // connection/bandwidth on mobile — deferred (below) to right after
  // first paint instead, via requestIdleCallback so it never blocks or
  // delays anything actually visible yet.
  useEffect(() => {
    supabase
      .from('bounties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .then(({ count }) => setLiveBountyCount(count ?? 0))
    supabase.from('projects').select('id', { count: 'exact', head: true }).then(({ count }) => setProjectCount(count ?? 0))
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
    const cancel = deferIdle(() => {
      // Featured first, then newest — the homepage only ever shows 4,
      // so anything an admin has marked is_featured surfaces before it.
      supabase
        .from('bounties')
        .select('*')
        .eq('status', 'approved')
        .eq('is_deleted', false)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4)
        .then(({ data }) => setBounties((data as Bounty[]) ?? []))

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

      supabase.from('projects').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(4).then(({ data }) => setEcosystemProjects((data as EcosystemProject[]) ?? []))

      // Exactly the official, curated Monad Africa roster — currently 3
      // active members. Same table/query /team itself uses.
      supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(3)
        .then(({ data }) => setTeamMembers((data as TeamMember[]) ?? []))

      // Real per-country builder counts (leaderboard_public.country) —
      // same source/query /explore's Africa map already uses. Powers
      // the "Explore Africa" section's map + country list below; never
      // a fake/random node.
      supabase
        .from('leaderboard_public')
        .select('country')
        .not('country', 'is', null)
        .limit(300)
        .then(({ data }) => {
          const counts = new Map<string, number>()
          for (const row of (data as { country: string | null }[]) ?? []) {
            if (!row.country) continue
            counts.set(row.country, (counts.get(row.country) ?? 0) + 1)
          }
          setCountries(Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12))
        })

      // Real XP ranking, same leaderboard_public view /leaderboard
      // reads — "Top Contributors" is never invented placeholder names.
      supabase
        .from('leaderboard_public')
        .select('*')
        .order('xp', { ascending: false })
        .limit(3)
        .then(({ data }) => setTopContributors((data as PublicProfile[]) ?? []))
    })
    return cancel
  }, [])

  return (
    <>
      <Hero content={content} settings={settings} liveBountyCount={liveBountyCount} projectCount={projectCount} />
      <LiveEcosystemSection activity={activity} />
      <DiscoveryGrid bounties={bounties} teamMembers={teamMembers} projects={ecosystemProjects} />
      <ExploreAfricaSection countries={countries} />
      <CommunitySection events={events} settings={settings} topContributors={topContributors} />
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
// than a set of differently-styled blocks stitched together. Sized for
// a denser page than before (text-3xl not text-5xl, tighter mb) — see
// the reference's own much smaller section headers.
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
    <Reveal className="flex flex-wrap items-end justify-between gap-6 mb-8">
      <div className="max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-wider text-purple-light">{kicker}</span>
        <h2 className="font-display font-semibold text-3xl md:text-4xl mt-3">{title}</h2>
        {subtitle && <p className="text-white/55 leading-relaxed mt-3 max-w-xl text-sm">{subtitle}</p>}
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
// re-render just because an unrelated sibling's data arrived.
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
    { label: 'Builders', value: settings.builders_onboarded, Icon: Users },
    { label: 'Projects', value: projectCount, Icon: Boxes },
    { label: 'Opportunities', value: liveBountyCount, Icon: Target },
    { label: 'Countries', value: settings.countries_reached, Icon: Globe2 },
  ]

  // Root cause of the desktop "hero floats too low" gap: min-h-[92vh] +
  // items-center vertically centers the content inside a near-full-
  // viewport box instead of letting it sit right under the fixed nav.
  // Mobile keeps that exact original behavior (unchanged); md+ drops
  // the forced min-height and top-alignment instead, so the section
  // just hugs its content — same pt-32 gap under the navbar as before,
  // no vertical-centering slack below it.
  return (
    <section className="relative min-h-[92vh] md:min-h-0 flex items-center md:items-start pt-32 pb-16 overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-gradient-to-br from-ink via-ink to-[#140a1e]" />
      {/* Smaller box + lighter blur radius on mobile — a large blur
          filter is genuinely expensive to paint on mobile GPUs, and
          these two sit above the fold so content-visibility can't defer
          them the way it does for every section below. Same glow, same
          position, just a cheaper kernel size below the md breakpoint;
          full size returns at md+ where there's more GPU headroom. */}
      <div className="absolute -z-10 w-[340px] h-[340px] md:w-[600px] md:h-[600px] rounded-full bg-purple-glow blur-[70px] md:blur-[120px] opacity-40 top-[-200px] right-[-160px]" />
      <div className="absolute -z-10 w-[280px] h-[280px] md:w-[500px] md:h-[500px] rounded-full bg-sunset-coral blur-[70px] md:blur-[130px] opacity-[0.18] bottom-[-200px] left-[-140px]" />
      <KentePattern className="absolute inset-0 -z-10 text-white opacity-[0.03]" />

      <div className="max-w-7xl mx-auto px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div>
            <Reveal>
              <div className="mb-6"><MonadMark size={36} /></div>
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-purple-light">
                {/* The subtle "live" status dot — gentle glow/fade loop via
                    tailwind.config.js's monad-pulse animation; only this
                    dot animates, never the text. motion-reduce:animate-none
                    drops the animation (keeping the static glow) for
                    prefers-reduced-motion. */}
                <span className="w-1.5 h-1.5 rounded-sm bg-purple shadow-[0_0_10px_#8C79FF] animate-monad-pulse motion-reduce:animate-none" />
                Welcome to Monad Africa
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="font-display font-semibold text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.05] tracking-tight mt-5 mb-6">
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
              {/* Secondary-tier CTA — still deliberately not a third
                  solid gradient button (that would compete with the two
                  primary buttons above), but sized and weighted close to
                  them now: a tinted-from-the-start pill (not just on
                  hover) with a real border, comfortably tap-sized on
                  mobile. Previous plain-text and light-ghost-pill
                  versions both read as too minor per feedback. */}
              <Link
                to={session ? '/dashboard' : '/signup'}
                className="group inline-flex items-center gap-2.5 text-lg font-semibold text-white hover:text-white px-7 py-3.5 rounded-full border border-purple-light/40 bg-purple/10 hover:bg-purple/20 hover:border-purple-light/70 hover:-translate-y-0.5 transition-all mb-10"
              >
                {session ? 'Go to Dashboard' : 'Get Started'}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </Reveal>

            <Reveal delay={400}>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <s.Icon size={16} className="text-purple-light shrink-0" />
                    <div>
                      <div className="font-display font-semibold text-xl leading-none"><Counter value={s.value} suffix="+" /></div>
                      <div className="text-white/45 text-xs mt-1">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* The Africa map — derived from the real Monad Africa "network
              map" brand asset (public/brand/africa-network-map.jpg —
              identical file to references/map.jpeg), not a hand-drawn SVG
              outline. A CSS mask over the opaque jpg still left a faint
              rectangular edge/background visible, because the jpg itself
              has no alpha channel — masking only fakes transparency at
              the image's own border, it can't remove the solid
              background inside it. So this is a real cutout: a one-time
              processing pass (Pillow, see the session notes) keyed the
              jpg's dark background out by luminance into genuine alpha
              transparency, then applied the same purple hue shift
              directly into the pixels — africa-network-map-purple.webp
              (71KB). Its glow, nodes and connecting lines are the exact
              same real artwork's bright pixels, just with the actual
              background gone rather than hidden. The live, per-country
              interactive map (real leaderboard_public data) still lives
              further down in "Explore Africa", unchanged — the hero's
              job is brand art, not a data visualization. */}
          <Reveal delay={150} className="order-first lg:order-last">
            <img
              src="/brand/africa-network-map-purple.webp"
              alt="Stylized network map of the African continent, representing the Monad ecosystem's reach across Africa"
              width={699}
              height={440}
              className="w-full h-auto max-h-[280px] lg:max-h-[480px] object-contain mx-auto"
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
})

// "Live across the ecosystem" — a compact teaser of /events'
// "Ecosystem Pulse" feed (ecosystem_activity, migration 0043/0046).
// Deliberately NOT a fake calendar: real published rows only, each with
// an honest freshness label (freshnessLabel never claims "Live" unless
// a row genuinely still is). The icon/tint per card is a presentation
// choice keyed off real fields (pulse_category, falling back to a
// neutral default) — it never changes what data is shown, just how a
// real category reads visually.
const PULSE_VISUAL: Partial<Record<NonNullable<EcosystemActivity['pulse_category']>, { Icon: typeof Sparkles; tint: string }>> = {
  event: { Icon: CalendarDays, tint: 'bg-purple/15 text-purple-light' },
  announcement: { Icon: Megaphone, tint: 'bg-amber-400/15 text-amber-300' },
  network: { Icon: Radio, tint: 'bg-emerald-400/15 text-emerald-300' },
  builder: { Icon: Users, tint: 'bg-purple/15 text-purple-light' },
  ecosystem: { Icon: Boxes, tint: 'bg-purple/15 text-purple-light' },
  community: { Icon: MessageCircle, tint: 'bg-rose-400/15 text-rose-300' },
}
const DEFAULT_PULSE_VISUAL = { Icon: Sparkles, tint: 'bg-purple/15 text-purple-light' }

const LiveEcosystemSection = memo(function LiveEcosystemSection({ activity }: { activity: EcosystemActivity[] | null }) {
  if (activity !== null && activity.length === 0) return null // no clutter from an empty section

  return (
    <section className="py-16" style={SKIP_OFFSCREEN_WORK('820px')}>
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro kicker="What's happening" title="Live across the ecosystem" cta={{ label: 'View all updates', to: '/events' }} />

        {activity === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {activity.map((item, i) => {
              const { Icon, tint } = (item.pulse_category && PULSE_VISUAL[item.pulse_category]) || DEFAULT_PULSE_VISUAL
              return (
                <Reveal key={item.id} delay={i * 60}>
                  <Link to="/events" className="block rounded-2xl border border-white/10 bg-white/[0.02] p-5 h-full hover:border-purple/40 hover:-translate-y-1 transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}><Icon size={17} /></div>
                      <span className="text-[10px] font-mono uppercase text-white/40 truncate">{item.category || item.status}</span>
                    </div>
                    <h3 className="font-display font-semibold text-base mb-1.5 leading-snug">{item.title}</h3>
                    {item.statistic_value ? (
                      <div className="font-display font-semibold text-lg text-purple-light">{item.statistic_value}</div>
                    ) : (
                      item.description && <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{item.description}</p>
                    )}
                    <div className="text-white/35 text-[10px] font-mono mt-3">{freshnessLabel(item)}</div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
})

// The 3-column "discovery" area — Opportunities / Featured Builders /
// Built in Africa, all real data, all compact rows. Replaces what used
// to be three separate full-width sections; the reference's dense
// 3-up layout groups them as one cohesive "here's the platform" view
// instead of a long scroll of similar-looking bands.
const DiscoveryGrid = memo(function DiscoveryGrid({
  bounties,
  teamMembers,
  projects,
}: {
  bounties: Bounty[] | null
  teamMembers: TeamMember[] | null
  projects: EcosystemProject[] | null
}) {
  return (
    <section className="py-16" style={SKIP_OFFSCREEN_WORK('1500px')}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Reveal>
            <DiscoveryColumn kicker="Opportunities" title="Find your next opportunity" cta={{ label: 'Explore all opportunities', to: '/opportunities' }}>
              {bounties === null ? (
                <RowSkeletons />
              ) : bounties.length === 0 ? (
                <p className="text-white/40 text-xs py-4">No active opportunities yet — check back soon.</p>
              ) : (
                bounties.map((b) => <OpportunityRow key={b.id} bounty={b} />)
              )}
            </DiscoveryColumn>
          </Reveal>

          <Reveal delay={80}>
            <DiscoveryColumn kicker="Featured builders" title="Meet the builders" cta={{ label: 'Meet the team', to: '/team' }}>
              {teamMembers === null ? (
                <RowSkeletons />
              ) : teamMembers.length === 0 ? (
                <p className="text-white/40 text-xs py-4">Team profiles are being set up.</p>
              ) : (
                teamMembers.map((m) => <TeamMemberRow key={m.id} member={m} />)
              )}
            </DiscoveryColumn>
          </Reveal>

          <Reveal delay={160}>
            <DiscoveryColumn kicker="Built in Africa" title="Projects building on Monad" cta={{ label: 'Explore all projects', to: '/explore' }}>
              {projects === null ? (
                <RowSkeletons />
              ) : projects.length === 0 ? (
                <p className="text-white/40 text-xs py-4">No projects published yet.</p>
              ) : (
                projects.map((p) => <ProjectRow key={p.id} project={p} />)
              )}
            </DiscoveryColumn>
          </Reveal>
        </div>
      </div>
    </section>
  )
})

function RowSkeletons() {
  return (
    <div className="flex flex-col divide-y divide-white/10">
      {[0, 1, 2].map((i) => <div key={i} className="h-14 flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-white/[0.04] animate-pulse shrink-0" /><div className="h-3 w-2/3 rounded bg-white/[0.04] animate-pulse" /></div>)}
    </div>
  )
}

function DiscoveryColumn({
  kicker,
  title,
  cta,
  children,
}: {
  kicker: string
  title: string
  cta: { label: string; to: string }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 flex flex-col h-full">
      <span className="font-mono text-[10px] uppercase tracking-wider text-purple-light">{kicker}</span>
      <h3 className="font-display font-semibold text-lg mt-2 mb-1">{title}</h3>
      <div className="flex-1 flex flex-col divide-y divide-white/10 mt-2">{children}</div>
      <Link to={cta.to} className="mt-5 pt-4 border-t border-white/10 text-sm font-semibold text-purple-light hover:text-white transition-colors">
        {cta.label} →
      </Link>
    </div>
  )
}

function OpportunityRow({ bounty }: { bounty: Bounty }) {
  return (
    <Link to="/opportunities" className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-display font-bold">
        {bounty.logo_url ? <img src={bounty.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : bounty.project_name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate group-hover:text-purple-light transition-colors">{bounty.title}</div>
        <div className="text-white/40 text-xs truncate">{bounty.reward} · Due {formatEventDate(bounty.deadline)}</div>
      </div>
      <span className="text-[9px] font-mono uppercase px-2 py-1 rounded-full border border-white/15 text-white/45 shrink-0">{bounty.category}</span>
    </Link>
  )
}

function ProjectRow({ project }: { project: EcosystemProject }) {
  const inner = (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-display font-bold">
        {project.logo_url ? <img src={project.logo_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : project.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{project.name}</div>
        {project.category && <div className="text-white/40 text-xs truncate">{project.category}</div>}
      </div>
    </div>
  )
  return project.website ? (
    <a href={project.website} target="_blank" rel="noopener noreferrer" className="-mx-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors block">{inner}</a>
  ) : (
    <div>{inner}</div>
  )
}

// The larger, standalone Africa section — same real per-country data as
// the hero map (passed down from Home()), just a bigger map plus a
// "Popular Countries" list. Mirrors /explore's own "Explore Africa"
// section (same component, same query), so the two stay visually and
// factually consistent.
const ExploreAfricaSection = memo(function ExploreAfricaSection({ countries }: { countries: { name: string; count: number }[] | null }) {
  const mapNodes: MapNode[] = useMemo(
    () =>
      (countries ?? [])
        .map((c): MapNode | null => {
          const pos = positionFor(c.name)
          if (!pos) return null
          return { name: c.name, x: pos.x, y: pos.y, value: c.count, detail: `${c.count} builder${c.count === 1 ? '' : 's'}` }
        })
        .filter((n): n is MapNode => n !== null),
    [countries],
  )

  return (
    <section className="py-16 relative overflow-hidden" style={SKIP_OFFSCREEN_WORK('1250px')}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-[40px] border border-white/10 bg-panel/30 p-8 md:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_0.7fr] gap-10 items-center">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-wider text-purple-light flex items-center gap-2"><Globe2 size={14} /> Explore Africa</span>
              <h2 className="font-display font-semibold text-2xl md:text-3xl mt-4 mb-4">Discover the ecosystem across the continent.</h2>
              <p className="text-white/55 text-sm leading-relaxed max-w-md mb-7">
                Monad Africa connects builders, creators, projects, opportunities and communities across
                African countries — every node on the map is a real, registered builder location.
              </p>
              <Link to="/explore" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
                Explore Africa Map →
              </Link>
            </Reveal>

            <Reveal delay={100}>
              {countries === null ? (
                <div className="aspect-[600/620] max-h-[380px] rounded-3xl bg-white/[0.02] animate-pulse" />
              ) : (
                <AfricaNetworkMap nodes={mapNodes} interactive className="w-full max-h-[380px] mx-auto" />
              )}
            </Reveal>

            <Reveal delay={150}>
              <span className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Popular Countries</span>
              {countries === null ? (
                <div className="flex flex-col gap-2.5">
                  {[0, 1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-white/[0.03] animate-pulse" />)}
                </div>
              ) : countries.length === 0 ? (
                <p className="text-white/40 text-xs">Country data will appear as builders join and set their location.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {countries.slice(0, 8).map((c) => {
                    const flag = flagFor(c.name)
                    return (
                      <div key={c.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          {flag && <span className="shrink-0">{flag}</span>}
                          <span className="truncate text-white/75">{c.name}</span>
                        </span>
                        <span className="text-white/35 text-xs font-mono shrink-0">{c.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <Link to="/explore" className="inline-block mt-4 text-xs font-semibold text-purple-light hover:text-white transition-colors">View all countries →</Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
})

// "Community" — real upcoming events, real community channels
// (site_settings), and a real Top Contributors ranking
// (leaderboard_public.xp, same data /leaderboard uses). The reference's
// fourth card ("Community Stories") has no real backing content model
// in this app yet, so it's deliberately left out rather than filled
// with placeholder copy — see the session's final report.
const CommunitySection = memo(function CommunitySection({
  events,
  settings,
  topContributors,
}: {
  events: EventListing[] | null
  settings: SiteSettings
  topContributors: PublicProfile[] | null
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const upcoming = useMemo(() => (events ?? []).slice(0, 3), [events])

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
    <section className="py-16 bg-panel/30 border-y border-white/10" style={SKIP_OFFSCREEN_WORK('1450px')}>
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro
          kicker="Community"
          title="Connect, learn, and grow together."
          subtitle="Events, channels, and the people most active across Monad Africa."
          cta={{ label: 'Visit the community', to: '/community' }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <CommunityCard icon={CalendarDays} label="Upcoming Events">
            {upcoming.length === 0 ? (
              <p className="text-white/40 text-xs">No upcoming events right now.</p>
            ) : (
              <div className="flex flex-col divide-y divide-white/10">
                {upcoming.map((e) => (
                  <button key={e.id} onClick={() => openEvent(e)} className="text-left py-2 first:pt-0 last:pb-0 hover:text-purple-light transition-colors">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-white/40 text-xs mt-0.5">{formatEventDate(e.event_date)}</div>
                  </button>
                ))}
              </div>
            )}
            <Link to="/events" className="mt-4 pt-3 border-t border-white/10 text-xs font-semibold text-purple-light hover:text-white transition-colors block">View all events →</Link>
          </CommunityCard>

          <CommunityCard icon={MessageCircle} label="Community Channels">
            {channels.length === 0 ? (
              <p className="text-white/40 text-xs">Channels coming soon.</p>
            ) : (
              <div className="flex flex-col divide-y divide-white/10">
                {channels.map((c) => (
                  <a key={c.label} href={c.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 hover:text-purple-light transition-colors">
                    {c.icon ? <c.icon size={14} className="text-purple-light shrink-0" /> : <span className="text-purple-light text-xs font-bold shrink-0">𝕏</span>}
                    <span className="text-sm font-medium">{c.label}</span>
                  </a>
                ))}
              </div>
            )}
            <Link to="/community" className="mt-4 pt-3 border-t border-white/10 text-xs font-semibold text-purple-light hover:text-white transition-colors block">Join a channel →</Link>
          </CommunityCard>

          <CommunityCard icon={Trophy} label="Top Contributors">
            {topContributors === null ? (
              <RowSkeletons />
            ) : topContributors.length === 0 ? (
              <p className="text-white/40 text-xs">Rankings will appear as builders earn XP.</p>
            ) : (
              <div className="flex flex-col divide-y divide-white/10">
                {topContributors.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                    <span className="text-white/30 text-xs font-mono w-3 shrink-0">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[9px] font-display font-bold">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (p.full_name || p.username || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium truncate flex-1 min-w-0">{p.full_name || p.username || 'Builder'}</span>
                    <span className="text-white/35 text-xs font-mono shrink-0">{p.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
            <Link to="/leaderboard" className="mt-4 pt-3 border-t border-white/10 text-xs font-semibold text-purple-light hover:text-white transition-colors block">View leaderboard →</Link>
          </CommunityCard>
        </div>

        <Reveal>
          <span className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Monad Africa community</span>
          <CommunityStats settings={settings} compact />
        </Reveal>
      </div>
    </section>
  )
})

function CommunityCard({ icon: Icon, label, children }: { icon: typeof CalendarDays; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-5 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-purple/15 text-purple-light flex items-center justify-center shrink-0"><Icon size={15} /></div>
        <span className="font-display font-semibold text-sm">{label}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function FinalCta({ settings }: { settings: SiteSettings }) {
  return (
    <section className="py-20" style={SKIP_OFFSCREEN_WORK('520px')}>
      <div className="max-w-5xl mx-auto px-6">
        <Reveal>
          <div className="relative rounded-[40px] border border-white/10 bg-gradient-to-br from-panel to-ink p-12 md:p-16 text-center overflow-hidden">
            <div className="absolute -z-10 w-[500px] h-[500px] bg-sunset rounded-full blur-[100px] opacity-20 -top-40 left-1/2 -translate-x-1/2" />
            <h2 className="font-display font-semibold text-3xl md:text-5xl mb-5">Africa is building. Find your place.</h2>
            <p className="text-white/60 max-w-lg mx-auto mb-9 leading-relaxed">
              Join the growing community of builders, creators and contributors shaping the future of Monad in Africa.
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
              <Link to="/partners#partner-form" className="text-white/50 hover:text-white transition-colors">Partner with Monad Africa →</Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
