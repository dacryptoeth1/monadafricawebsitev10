import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, CalendarDays, Globe2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { EcosystemProject, EventListing } from '../types'
import CountryFlag from '../components/CountryFlag'
import { positionFor } from '../lib/africaGeo'
import { formatEventDate } from '../lib/eventStatus'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'
import AfricaNetworkMap, { type MapNode } from '../components/AfricaNetworkMap'
import { OrganiserLogo } from '../components/EventCard'

// The ecosystem discovery hub — one of the four main IA sections
// (Explore / Builders / Opportunities / Community). Deliberately a
// curated overview, not an exhaustive dashboard: featured projects link
// out to the full /ecosystem list, and "Popular Countries" is derived
// from real builder profile data (leaderboard_public.country) rather
// than an invented per-country breakdown — Monad Africa doesn't store
// a country on projects/opportunities, so this page doesn't pretend to
// filter ecosystem activity by country, only shows where the community
// itself is actually based.
export default function Explore() {
  const [projects, setProjects] = useState<EcosystemProject[] | null>(null)
  const [countries, setCountries] = useState<{ name: string; count: number }[] | null>(null)
  const [events, setEvents] = useState<EventListing[] | null>(null)

  // Real per-country builder counts, placed on the map wherever
  // africaGeo.ts has a known position for that country name — a
  // country with builders but no known position just doesn't get a
  // node rather than being placed randomly.
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

  useEffect(() => {
    supabase
      .from('projects')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setProjects((data as EcosystemProject[]) ?? []))

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
        const sorted = Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10)
        setCountries(sorted)
      })

    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(2)
      .then(({ data }) => setEvents((data as EventListing[]) ?? []))
  }, [])

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="mb-16">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Explore</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4 max-w-2xl">Discover the ecosystem across Africa.</h1>
          <p className="text-white/55 leading-relaxed max-w-xl">
            Projects, builders, and activity shaping the Monad ecosystem — from Lagos to Nairobi to Cape Town.
          </p>
        </Reveal>

        {/* Featured projects */}
        <div className="mb-20">
          <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <h2 className="font-display font-semibold text-2xl flex items-center gap-2"><Boxes size={20} className="text-purple-light" /> Projects building on Monad</h2>
            <Link to="/ecosystem" className="text-sm font-semibold text-purple-light hover:text-white transition-colors">View all projects →</Link>
          </Reveal>

          {projects === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState Icon={Boxes} message="No featured ecosystem projects yet." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p, i) => {
                const body = (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden mb-4">
                      {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-sm">{p.name.slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <h3 className="font-display font-semibold text-base mb-1.5">{p.name}</h3>
                    <p className="text-white/50 text-sm leading-relaxed line-clamp-2">{p.description}</p>
                    {p.category && <span className="inline-block mt-4 text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{p.category}</span>}
                  </>
                )
                // A project with no website renders as a plain card, not
                // an anchor to "#" that looks clickable and goes nowhere.
                const base = 'block rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full'
                return (
                  <Reveal key={p.id} delay={i * 50}>
                    {p.website ? (
                      <a href={p.website} target="_blank" rel="noopener noreferrer" className={`${base} hover:border-purple/40 hover:-translate-y-1 transition-all`}>{body}</a>
                    ) : (
                      <div className={base}>{body}</div>
                    )}
                  </Reveal>
                )
              })}
            </div>
          )}
        </div>

        {/* Explore Africa — real activity nodes (per-country builder
            counts from leaderboard_public), not a decorative map. Hover
            or tap a node for the real count behind it; a country only
            gets a node once it actually has builders and a known
            position (see africaGeo.ts). */}
        <div className="relative rounded-[40px] border border-white/10 bg-panel/30 p-8 md:p-12 mb-20 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 items-center">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-wider text-purple-light flex items-center gap-2"><Globe2 size={14} /> Explore Africa</span>
              <h2 className="font-display font-semibold text-2xl md:text-3xl mt-4 mb-4">Where the community is building from.</h2>
              <p className="text-white/55 text-sm leading-relaxed max-w-md mb-8">
                Every node is a real country in the Monad Africa community — sized by how many registered builders are based there. Hover or tap a node for the count.
              </p>

              {countries === null ? (
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  {[0, 1, 2, 3].map((i) => <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />)}
                </div>
              ) : countries.length === 0 ? (
                <p className="text-white/40 text-sm">Country data will appear here as builders join and set their location.</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-w-sm">
                  {countries.slice(0, 6).map((c) => (
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
            </Reveal>
            <Reveal delay={100}>
              {countries === null ? (
                <div className="aspect-[699/440] max-h-[420px] rounded-3xl bg-white/[0.02] animate-pulse" />
              ) : (
                <AfricaNetworkMap nodes={mapNodes} interactive showLabels className="block w-full max-w-full h-auto max-h-[420px] mx-auto" />
              )}
            </Reveal>
          </div>
        </div>

        {/* Events teaser */}
        {events !== null && events.length > 0 && (
          <div>
            <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <h2 className="font-display font-semibold text-2xl flex items-center gap-2"><CalendarDays size={20} className="text-purple-light" /> Happening soon</h2>
              <Link to="/events" className="text-sm font-semibold text-purple-light hover:text-white transition-colors">View all events →</Link>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {events.map((e, i) => (
                <Reveal key={e.id} delay={i * 60}>
                  <Link to="/events" className="flex items-center gap-4 rounded-squircle border border-white/10 bg-white/[0.02] p-5 hover:border-purple/40 transition-colors">
                    <OrganiserLogo name={e.organiser_name || 'Monad Africa'} logoUrl={e.organiser_logo_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-sm truncate">{e.title}</h3>
                      <p className="text-white/45 text-xs mt-1">{formatEventDate(e.event_date)}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
