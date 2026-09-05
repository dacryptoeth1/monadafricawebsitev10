import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Boxes, CalendarDays, Globe2, Mic, Sparkles, Target, Trophy, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Bounty, CommunityStory, EcosystemProject, EventListing, PublicProfile, SiteContent, SiteSettings, TeamMember } from '../types'
import { useSiteSettings } from '../hooks/useSiteSettings'
import { formatEventDate } from '../lib/eventStatus'
import { positionFor } from '../lib/africaGeo'
import Counter from '../components/Counter'
import AfricaNetworkMap, { type MapNode } from '../components/AfricaNetworkMap'
import { KentePattern } from '../components/PatternBackground'
import CountryFlag from '../components/CountryFlag'
import { TeamMemberFeaturedRow } from '../components/TeamMemberCard'
import MonadMark from '../components/MonadMark'
import CommunityStats from '../components/CommunityStats'

// Built against the reference layout the product spec supplies
// (references/interface.jpeg — "the book"): dense, card-based,
// Africa-map-centric — Hero -> Live across the ecosystem -> 3-column
// Discovery (Opportunities / Featured Builders / Projects) -> Explore
// Africa -> Community -> final CTA. Every section reads from the exact
// same tables/queries the rest of the site already uses (bounties,
// projects, events, leaderboard_public, community_stories,
// community_stats) — this is a re-composition of real data, not a new
// backend, and nothing on this page is hardcoded.
//
// Two deliberate corrections against the book, from the marketing
// review:
//   * "Live across the ecosystem" shows THIS PLATFORM'S activity — a
//     real opportunity, a real project, a real event — exactly the
//     three card types the book draws. It used to show generic Monad
//     blog posts and a global TVL figure from `ecosystem_activity`,
//     which is what "doesn't correlate with what's in the book" meant.
//     That feed still exists in full on /events (Ecosystem Pulse),
//     where global Monad news belongs.
//   * "Featured Builders" shows registered community members from
//     `leaderboard_public`, not the Monad Africa team roster. The team
//     has its own page at /team.
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

// The deeper half of deferring below-the-fold work: content-visibility
// (used throughout this file) stops the *browser* from doing layout/
// paint for an offscreen section, but React itself still mounts every
// component in that subtree immediately — every <HomeReveal>'s own
// intersection tracking, every child component's effects — the instant
// Home() first renders, regardless of how far down the page they are.
// With 18 HomeReveal instances across the sections below the hero,
// that's real mount-time JS work paid up front on every visit, on
// every device, before the user has scrolled at all. This defers the
// *mount* itself: nothing below renders (skeletons included) until
// it's within `rootMargin` of the viewport, using one plain
// IntersectionObserver — no Framer Motion, negligible overhead of its
// own. A generous rootMargin (600px) means it has already mounted well
// before a normally-scrolling visitor actually reaches it, so there's
// no visible pop-in, only a deferred *start* time.
function LazySection({ children, minHeight }: { children: React.ReactNode; minHeight: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return <div ref={ref}>{visible ? children : <div style={{ minHeight }} />}</div>
}

// A homepage-only replacement for the shared `<Reveal>` component
// (src/components/Reveal.tsx, still used unchanged by 22 other pages —
// not touched here). Home.tsx mounts 18 of these, each previously a
// full Framer Motion `motion.div` with its own `whileInView` visual
// element, animation controls, and viewport-intersection tracking —
// real per-instance setup cost for an effect that's visually just
// "fade in + rise 24px, once." This produces the exact same visible
// animation (same 700ms cubic-bezier(0.2,0.7,0.2,1) easing, the same
// 24px default rise, the same "-80px" trigger margin, still once-only)
// with a single plain IntersectionObserver per instance and a CSS
// transition instead — no Framer Motion involved. Respects
// prefers-reduced-motion the same way MotionConfig's `reducedMotion:
// "user"` does app-wide: drops the rise, keeps the opacity fade.
function HomeReveal({
  children,
  className = '',
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const [reduceMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '-80px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: reduceMotion || shown ? 'none' : `translateY(${y}px)`,
        transition: `opacity 0.7s cubic-bezier(0.2,0.7,0.2,1) ${delay}ms, transform 0.7s cubic-bezier(0.2,0.7,0.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// Homepage-only corrections layered onto the exact same real
// team_members rows /team reads — nothing here adds, removes, or
// invents a person; it only affects what this one card displays for
// the three real, existing rows.
//
// Keyed by team_members.name so this only ever touches these specific
// three (Dacrypto, CryptoTester, Sammy) — a future 4th real active team
// member would render straight from their own real team_members data,
// unaffected.
//
//   - `role`: the exact label given for this card (Founder / Co-Founder
//     / Marketing Lead). team_members.primary_role still reads
//     "Community Support" for Sammy and "Co-founder · Marketing Lead"
//     for CryptoTester everywhere else (/team, Admin → Team Management)
//     — unchanged there, this override is scoped to this one section.
//   - `name`: CryptoTester's team_members.name column has a typo.
//     Every other real handle already in the project for this same
//     person — x_url "x.com/cryptotesteer", telegram_url
//     "t.me/CryptoTesteer" — spells it "CryptoTesteer". Corrected for
//     display here rather than left wrong; the shared `name` column
//     itself is untouched.
//   - `leaderboardUsername`: team_members has no country or XP column
//     at all. Each of these three also has their own real, existing
//     Monad Africa community profile (leaderboard_public) — this is
//     that account's real username, used to pull their genuine country
//     and XP rather than inventing either. If that lookup ever finds
//     nothing (account deleted/renamed), the row just omits those two
//     fields, same as any other member with no match.
const FEATURED_TEAM_OVERRIDES: Record<string, { name?: string; role: string; leaderboardUsername: string }> = {
  Dacrypto: { role: 'Founder', leaderboardUsername: 'Dacrypto' },
  CryptoTester: { name: 'CryptoTesteer', role: 'Co-Founder', leaderboardUsername: 'cryptotesteer' },
  Sammy: { role: 'Marketing Lead', leaderboardUsername: 'Sammy' },
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
  const [stories, setStories] = useState<CommunityStory[] | null>(null)
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

      supabase.from('projects').select('*').order('is_featured', { ascending: false }).order('created_at', { ascending: false }).limit(4).then(({ data }) => setEcosystemProjects((data as EcosystemProject[]) ?? []))

      // "Featured Builders" — the real, curated Monad Africa core team
      // (team_members, migration 0035 — same table/query /team itself
      // reads). Per the marketing lead's follow-up request, this section
      // is explicitly the team, not the community leaderboard: /builders
      // remains the separate community directory, linked from the
      // section's own "Explore all builders" CTA below. `limit(4)` just
      // caps it at the reference layout's 4 rows — there are currently 3
      // active members, so nothing pads it out to a 4th.
      supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(4)
        .then(async ({ data }) => {
          const members = (data as TeamMember[]) ?? []

          // Pull each overridden member's real country + XP from their
          // own existing community profile (see FEATURED_TEAM_OVERRIDES
          // above) — a second, tiny query rather than a join, since
          // leaderboard_public has no relationship to team_members.
          const usernames = members
            .map((m) => FEATURED_TEAM_OVERRIDES[m.name]?.leaderboardUsername)
            .filter((u): u is string => !!u)

          const profilesByUsername = new Map<string, { country: string | null; xp: number }>()
          if (usernames.length > 0) {
            const { data: profiles } = await supabase
              .from('leaderboard_public')
              .select('username, country, xp')
              .in('username', usernames)
            for (const p of (profiles as { username: string | null; country: string | null; xp: number }[]) ?? []) {
              if (p.username) profilesByUsername.set(p.username, { country: p.country, xp: p.xp })
            }
          }

          setTeamMembers(
            members.map((m) => {
              const override = FEATURED_TEAM_OVERRIDES[m.name]
              if (!override) return m
              const profile = profilesByUsername.get(override.leaderboardUsername)
              return {
                ...m,
                name: override.name ?? m.name,
                primary_role: override.role,
                country: profile?.country ?? m.country,
                points: profile?.xp ?? m.points,
              }
            }),
          )
        })

      // Community Stories (migration 0049). An error here — most likely
      // the migration not having been applied yet — lands in the same
      // place an empty table does: the card renders its empty state.
      supabase
        .from('community_stories')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(3)
        .then(({ data }) => setStories((data as CommunityStory[]) ?? []))

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
      <LazySection minHeight="820px"><LiveEcosystemSection bounties={bounties} projects={ecosystemProjects} events={events} /></LazySection>
      <LazySection minHeight="1500px"><DiscoveryGrid bounties={bounties} teamMembers={teamMembers} projects={ecosystemProjects} /></LazySection>
      <LazySection minHeight="1250px"><ExploreAfricaSection countries={countries} /></LazySection>
      <LazySection minHeight="1450px"><CommunitySection events={events} settings={settings} topContributors={topContributors} stories={stories} /></LazySection>
      <LazySection minHeight="520px"><FinalCta settings={settings} /></LazySection>
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
    <HomeReveal className="flex flex-wrap items-end justify-between gap-6 mb-8">
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
    </HomeReveal>
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
            <HomeReveal>
              <div className="mb-6"><MonadMark size={36} priority /></div>
              <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-purple-light">
                {/* The subtle "live" status dot — gentle glow/fade loop via
                    tailwind.config.js's monad-pulse animation; only this
                    dot animates, never the text. motion-reduce:animate-none
                    drops the animation (keeping the static glow) for
                    prefers-reduced-motion. */}
                <span className="w-1.5 h-1.5 rounded-sm bg-purple shadow-[0_0_10px_#8C79FF] animate-monad-pulse motion-reduce:animate-none" />
                Welcome to Monad Africa
              </span>
            </HomeReveal>
            <HomeReveal delay={100}>
              <h1 className="font-display font-semibold text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.05] tracking-tight mt-5 mb-6">
                {renderHeroTitle(content.hero_title)}
              </h1>
            </HomeReveal>
            <HomeReveal delay={200}>
              <p className="text-lg text-white/60 leading-relaxed max-w-xl mb-9">{content.hero_subtitle}</p>
            </HomeReveal>
            <HomeReveal delay={300}>
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
            </HomeReveal>

            {/* Smaller, visually secondary — sits under the two primary
                buttons rather than beside them. Reuses the existing
                signup/auth flow (no second auth system): signed-out
                visitors go to /signup, someone already signed in goes
                straight to their dashboard instead of being asked to
                sign up again. */}
            <HomeReveal delay={350}>
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
            </HomeReveal>

            <HomeReveal delay={400}>
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
            </HomeReveal>
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
          <HomeReveal delay={150} className="order-first lg:order-last">
            <img
              src="/brand/africa-network-map-purple.webp"
              alt="Stylized network map of the African continent, representing the Monad ecosystem's reach across Africa"
              width={699}
              height={440}
              // The largest single visual element in the initial viewport
              // (likely the page's actual LCP element) — fetchPriority
              // tells the browser to fetch it ahead of lower-priority
              // requests discovered at the same time during the initial
              // parse, instead of the default priority every other image
              // on the page gets.
              fetchPriority="high"
              className="w-full h-auto max-h-[280px] lg:max-h-[480px] object-contain mx-auto"
            />
          </HomeReveal>
        </div>
      </div>
    </section>
  )
})

// "Live across the ecosystem" — rebuilt to match the product spec
// (references/interface.jpeg). The book draws exactly three cards here,
// and each one is a THING ON THIS PLATFORM, not an item of Monad news:
//
//     OPPORTUNITY   $500 Bounty / Frontend Developer   [View opportunity ->]
//     PROJECT       KoraPay / payment infrastructure   [Explore project  ->]
//     EVENT         Monad Lagos Meetup / Sept 14       [View event       ->]
//
// The previous implementation instead read `ecosystem_activity` and
// showed "Monad Ecosystem TVL — $956.9M" and two monad.xyz blog posts.
// That data is real and still fully published — but it is global Monad
// news, which is the /events "Ecosystem Pulse" page's job, not this
// section's, and it is what the marketing lead meant by "it doesn't
// correlate with what's in the book."
//
// Each card is built from a row this page has ALREADY fetched for the
// Discovery grid below, so correcting this section costs zero extra
// queries. Every field shown is a real column (a bounty's reward and
// category, a project's category, an event's date and location) — the
// book's per-card country flags have no equivalent column on bounties
// or projects, so a real category is shown rather than a guessed
// country. A card type with nothing published simply doesn't appear;
// with nothing published at all, the section renders one honest empty
// state instead of being padded out.
type EcosystemHighlight = {
  key: string
  kicker: string
  Icon: typeof Target
  tint: string
  title: string
  subtitle: string | null
  meta: string | null
  cta: string
  to?: string
  href?: string
}

function buildHighlights(
  bounties: Bounty[] | null,
  projects: EcosystemProject[] | null,
  events: EventListing[] | null,
): EcosystemHighlight[] {
  const out: EcosystemHighlight[] = []

  const bounty = bounties?.[0]
  if (bounty) {
    out.push({
      key: `bounty-${bounty.id}`,
      kicker: 'Opportunity',
      Icon: Target,
      tint: 'bg-emerald-400/15 text-emerald-300',
      title: bounty.title,
      subtitle: bounty.reward || null,
      meta: bounty.category || null,
      cta: 'View opportunity',
      to: '/opportunities',
    })
  }

  const project = projects?.[0]
  if (project) {
    out.push({
      key: `project-${project.id}`,
      kicker: 'Project',
      Icon: Boxes,
      tint: 'bg-purple/15 text-purple-light',
      title: project.name,
      subtitle: project.description,
      meta: project.category || null,
      cta: 'Explore project',
      ...(project.website ? { href: project.website } : { to: '/ecosystem' }),
    })
  }

  const event = events?.[0]
  if (event) {
    out.push({
      key: `event-${event.id}`,
      kicker: 'Event',
      Icon: CalendarDays,
      tint: 'bg-amber-400/15 text-amber-300',
      title: event.title,
      subtitle: formatEventDate(event.event_date),
      meta: event.location || null,
      cta: 'View event',
      to: '/events',
    })
  }

  return out
}

const LiveEcosystemSection = memo(function LiveEcosystemSection({
  bounties,
  projects,
  events,
}: {
  bounties: Bounty[] | null
  projects: EcosystemProject[] | null
  events: EventListing[] | null
}) {
  const loading = bounties === null && projects === null && events === null
  const highlights = useMemo(() => buildHighlights(bounties, projects, events), [bounties, projects, events])

  return (
    <section className="py-16" style={SKIP_OFFSCREEN_WORK('820px')}>
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro kicker="What's happening" title="Live across the ecosystem" cta={{ label: 'View all updates', to: '/events' }} />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : highlights.length === 0 ? (
          <HomeReveal>
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 md:p-10 text-center">
              <div className="w-11 h-11 rounded-xl bg-purple/15 text-purple-light flex items-center justify-center mx-auto mb-4">
                <Sparkles size={18} />
              </div>
              <h3 className="font-display font-semibold text-lg mb-2">Nothing live right now.</h3>
              <p className="text-white/50 text-sm max-w-md mx-auto mb-6 leading-relaxed">
                New opportunities, projects and events across Monad Africa appear here the moment they go
                live. Nothing is listed until it is real.
              </p>
              <div className="flex flex-wrap gap-3 justify-center text-sm font-semibold">
                <Link to="/host-bounty" className="px-5 py-2.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">Host an Opportunity</Link>
                <Link to="/events" className="px-5 py-2.5 rounded-full text-purple-light hover:text-white transition-colors">See ecosystem updates →</Link>
              </div>
            </div>
          </HomeReveal>
        ) : (
          // 2-up at sm so a single missing card type never leaves a
          // stretched, half-empty row on tablet widths.
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {highlights.map((item, i) => (
              <HomeReveal key={item.key} delay={i * 60}>
                <HighlightCard item={item} />
              </HomeReveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
})

function HighlightCard({ item }: { item: EcosystemHighlight }) {
  const inner = (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.tint}`}><item.Icon size={17} /></div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 truncate">{item.kicker}</span>
      </div>
      <h3 className="font-display font-semibold text-base mb-1.5 leading-snug line-clamp-2">{item.title}</h3>
      {item.subtitle && <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{item.subtitle}</p>}
      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-white/10">
        {item.meta ? (
          <span className="text-[10px] font-mono uppercase px-2 py-1 rounded-full border border-white/15 text-white/45 truncate">{item.meta}</span>
        ) : (
          <span />
        )}
        <span className="text-xs font-semibold text-purple-light group-hover:text-white transition-colors shrink-0 whitespace-nowrap">{item.cta} →</span>
      </div>
    </>
  )

  const className = 'group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 h-full hover:border-purple/40 hover:-translate-y-1 transition-all'

  return item.href ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>{inner}</a>
  ) : (
    <Link to={item.to ?? '/explore'} className={className}>{inner}</Link>
  )
}

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
          <HomeReveal>
            <DiscoveryColumn kicker="Opportunities" title="Find your next opportunity" cta={{ label: 'Explore all opportunities', to: '/opportunities' }}>
              {bounties === null ? (
                <RowSkeletons />
              ) : bounties.length === 0 ? (
                <p className="text-white/40 text-xs py-4">No active opportunities yet — check back soon.</p>
              ) : (
                bounties.map((b) => <OpportunityRow key={b.id} bounty={b} />)
              )}
            </DiscoveryColumn>
          </HomeReveal>

          {/* The real, curated Monad Africa core team (team_members —
              same table/query /team itself reads). Per the marketing
              lead: this section represents the team, not the community
              leaderboard — the community's own builders live in the
              "Explore Africa" and "Community" sections below, and the
              full directory at /builders. Both the small "View all →"
              beside the heading and the "Explore all builders →" CTA at
              the bottom point at /team, since that's the real roster
              this card now shows. */}
          <HomeReveal delay={80}>
            <DiscoveryColumn
              kicker="Featured builders"
              title="Meet the builders"
              headerCta={{ label: 'View all', to: '/team' }}
              cta={{ label: 'Explore all builders', to: '/team' }}
            >
              {teamMembers === null ? (
                <RowSkeletons />
              ) : teamMembers.length === 0 ? (
                <p className="text-white/40 text-xs py-4">Team profiles are being set up.</p>
              ) : (
                teamMembers.map((m) => <TeamMemberFeaturedRow key={m.id} member={m} />)
              )}
            </DiscoveryColumn>
          </HomeReveal>

          <HomeReveal delay={160}>
            <DiscoveryColumn kicker="Built in Africa" title="Projects building on Monad" cta={{ label: 'Explore all projects', to: '/explore' }}>
              {projects === null ? (
                <RowSkeletons />
              ) : projects.length === 0 ? (
                <p className="text-white/40 text-xs py-4">No projects published yet.</p>
              ) : (
                projects.map((p) => <ProjectRow key={p.id} project={p} />)
              )}
            </DiscoveryColumn>
          </HomeReveal>
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
  headerCta,
  children,
}: {
  kicker: string
  title: string
  cta: { label: string; to: string }
  /**
   * The small "View all →" link beside the heading, matching the
   * reference layout's Featured Builders card exactly. Optional and
   * scoped to just that column — the Opportunities/Projects columns
   * next to it are intentionally left as they were.
   */
  headerCta?: { label: string; to: string }
  children: React.ReactNode
}) {
  return (
    <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 flex flex-col h-full">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-purple-light">{kicker}</span>
        {headerCta && (
          <Link to={headerCta.to} className="text-xs font-semibold text-purple-light hover:text-white transition-colors shrink-0">
            {headerCta.label} →
          </Link>
        )}
      </div>
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
            <HomeReveal>
              <span className="font-mono text-xs uppercase tracking-wider text-purple-light flex items-center gap-2"><Globe2 size={14} /> Explore Africa</span>
              <h2 className="font-display font-semibold text-2xl md:text-3xl mt-4 mb-4">Discover the ecosystem across the continent.</h2>
              <p className="text-white/55 text-sm leading-relaxed max-w-md mb-7">
                Monad Africa connects builders, creators, projects, opportunities and communities across
                African countries — every node on the map is a real, registered builder location.
              </p>
              <Link to="/explore" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple shadow-[0_8px_30px_-8px_rgba(110,84,255,0.65)] hover:-translate-y-0.5 transition-transform">
                Explore Africa Map →
              </Link>
            </HomeReveal>

            <HomeReveal delay={100}>
              {countries === null ? (
                <div className="aspect-[699/440] max-h-[380px] rounded-3xl bg-white/[0.02] animate-pulse" />
              ) : (
                // block + w-full + max-h keeps the SVG inside its column
                // at every width; showLabels means a phone (no hover)
                // still reads each country and its builder count without
                // having to tap.
                <AfricaNetworkMap nodes={mapNodes} interactive showLabels className="block w-full max-w-full h-auto max-h-[380px] mx-auto" />
              )}
            </HomeReveal>

            <HomeReveal delay={150}>
              <span className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Popular Countries</span>
              {countries === null ? (
                <div className="flex flex-col gap-2.5">
                  {[0, 1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-white/[0.03] animate-pulse" />)}
                </div>
              ) : countries.length === 0 ? (
                <p className="text-white/40 text-xs">Country data will appear as builders join and set their location.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {countries.slice(0, 8).map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <CountryFlag country={c.name} size={12} />
                        <span className="truncate text-white/75">{c.name}</span>
                      </span>
                      <span className="text-white/35 text-xs font-mono shrink-0">{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/explore" className="inline-block mt-4 text-xs font-semibold text-purple-light hover:text-white transition-colors">View all countries →</Link>
            </HomeReveal>
          </div>
        </div>
      </div>
    </section>
  )
})

// "Community" — the four cards the book draws: Upcoming Events,
// Monad Spaces, Community Stories, Top Contributors. The old
// "Community Channels" box (three outbound Discord/X/Telegram links) is
// gone, as asked; those links still live in the footer and on
// /community itself, so nothing became unreachable.
//
// Every card here opens the community experience rather than a separate
// destination — Monad Spaces and Community Stories are sections OF
// /community (#spaces / #stories), which is what "in regards to this
// section, everything should open in the community aspect" asks for. No
// card is a dead end, and none of them invent content: each shows real
// rows or a plain empty state.
const CommunitySection = memo(function CommunitySection({
  events,
  settings,
  topContributors,
  stories,
}: {
  events: EventListing[] | null
  settings: SiteSettings
  topContributors: PublicProfile[] | null
  stories: CommunityStory[] | null
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const upcoming = useMemo(() => (events ?? []).slice(0, 3), [events])

  // Monad Spaces are `events` rows whose type says so — an X Space IS a
  // scheduled event, so this reuses the existing events table (and all
  // of its admin tooling) instead of duplicating it with a second one.
  const spaces = useMemo(
    () => (events ?? []).filter((e) => /space/i.test(e.event_type ?? '')).slice(0, 3),
    [events],
  )

  function openEvent(event: EventListing) {
    if (!session) {
      navigate('/login', { state: { from: '/events', eventId: event.id } })
      return
    }
    navigate('/events', { state: { openEventId: event.id } })
  }

  return (
    <section className="py-16 bg-panel/30 border-y border-white/10" style={SKIP_OFFSCREEN_WORK('1450px')}>
      <div className="max-w-7xl mx-auto px-6">
        <SectionIntro
          kicker="Community"
          title="Connect, learn, and grow together."
          subtitle="Events, Spaces, stories, and the people most active across Monad Africa."
          cta={{ label: 'Visit the community', to: '/community' }}
        />

        {/* 1 / 2 / 4 columns — four cards in a single row would be
            unreadably narrow on a small laptop, and a 3-column grid
            would strand the fourth card alone on its own row. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <CommunityCard icon={CalendarDays} label="Upcoming Events">
            {events === null ? (
              <RowSkeletons />
            ) : upcoming.length === 0 ? (
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

          <CommunityCard icon={Mic} label="Monad Spaces">
            {events === null ? (
              <RowSkeletons />
            ) : spaces.length === 0 ? (
              <p className="text-white/40 text-xs leading-relaxed">
                Weekly X Spaces with builders and leaders across Monad Africa. The next one is listed
                here as soon as it is scheduled.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-white/10">
                {spaces.map((e) => (
                  <button key={e.id} onClick={() => openEvent(e)} className="text-left py-2 first:pt-0 last:pb-0 hover:text-purple-light transition-colors">
                    <div className="text-sm font-medium truncate">{e.title}</div>
                    <div className="text-white/40 text-xs mt-0.5">{formatEventDate(e.event_date)}</div>
                  </button>
                ))}
              </div>
            )}
            <Link to="/community#spaces" className="mt-4 pt-3 border-t border-white/10 text-xs font-semibold text-purple-light hover:text-white transition-colors block">Join a Space →</Link>
          </CommunityCard>

          <CommunityCard icon={BookOpen} label="Community Stories">
            {stories === null ? (
              <RowSkeletons />
            ) : stories.length === 0 ? (
              <p className="text-white/40 text-xs leading-relaxed">
                Stories from builders across Africa — what they are shipping on Monad, and how they got
                here. The first ones are being written.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-white/10">
                {stories.map((story) => (
                  <Link key={story.id} to="/community#stories" className="py-2 first:pt-0 last:pb-0 hover:text-purple-light transition-colors block">
                    <div className="text-sm font-medium truncate">{story.title}</div>
                    {story.author_name && <div className="text-white/40 text-xs mt-0.5 truncate">{story.author_name}</div>}
                  </Link>
                ))}
              </div>
            )}
            <Link to="/community#stories" className="mt-4 pt-3 border-t border-white/10 text-xs font-semibold text-purple-light hover:text-white transition-colors block">Read stories →</Link>
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

        <HomeReveal>
          <span className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Monad Africa community</span>
          <CommunityStats settings={settings} compact />
        </HomeReveal>
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
        <HomeReveal>
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
        </HomeReveal>
      </div>
    </section>
  )
}
