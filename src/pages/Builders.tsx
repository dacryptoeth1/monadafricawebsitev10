import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { PublicProfile } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'
import AfricaNetworkMap from '../components/AfricaNetworkMap'
import BuilderCard from '../components/BuilderCard'

// The public builder directory — one of the four main IA sections
// (Explore / Builders / Opportunities / Community). Reads the same
// `leaderboard_public` view (migration 0032) as Leaderboard.tsx, which
// stays in place as the dedicated ranked view; this page is the same
// real data presented as a browsable "who's building" directory rather
// than a ranked table, linking out to /leaderboard for anyone who wants
// the full ranking. No invented skills/roles — only the fields the view
// actually exposes (name, avatar, country, XP, referrals).
const DIRECTORY_SIZE = 60

export default function Builders() {
  const [builders, setBuilders] = useState<PublicProfile[] | null>(null)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('All')

  useEffect(() => {
    supabase
      .from('leaderboard_public')
      .select('*')
      .order('xp', { ascending: false })
      .limit(DIRECTORY_SIZE)
      .then(({ data }) => setBuilders((data as PublicProfile[]) ?? []))
  }, [])

  // Derived from the real fetched rows — not a fixed list — so it only
  // ever offers countries builders have actually set on their profile.
  const countries = useMemo(() => {
    if (!builders) return []
    const set = new Set(builders.map((b) => b.country).filter((c): c is string => !!c))
    return Array.from(set).sort()
  }, [builders])

  const filtered = useMemo(
    () =>
      builders
        ?.filter((b) => country === 'All' || b.country === country)
        .filter((b) => {
          if (!search.trim()) return true
          const q = search.toLowerCase()
          return (b.full_name || '').toLowerCase().includes(q) || (b.username || '').toLowerCase().includes(q)
        }) ?? null,
    [builders, country, search],
  )

  return (
    <section className="pt-36 pb-28 min-h-screen relative overflow-hidden">
      <AfricaNetworkMap className="absolute -z-10 w-[640px] max-w-[85vw] opacity-[0.05] right-[-12%] top-0" />
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Builders</span>
            <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">The people building on Monad, across Africa.</h1>
            <p className="text-white/55 leading-relaxed max-w-xl">
              Developers, designers, creators and contributors earning XP by shipping real work in the Monad Africa community.
            </p>
          </div>
          <Link to="/leaderboard" className="text-sm font-semibold text-purple-light hover:text-white transition-colors shrink-0">
            View full leaderboard →
          </Link>
        </Reveal>

        <Reveal className="flex flex-col sm:flex-row sm:items-center gap-3 mb-10">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search builders by name…"
              className="input w-full pl-10"
            />
          </div>
          {countries.length > 0 && (
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="input w-full sm:w-auto">
              <option value="All" className="bg-panel">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c} className="bg-panel">{c}</option>
              ))}
            </select>
          )}
        </Reveal>

        {filtered === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-40 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState Icon={Users} message={search.trim() || country !== 'All' ? 'No builders match that search.' : 'No builders on the leaderboard yet — be the first to earn XP.'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((b, i) => (
              <Reveal key={b.id} delay={Math.min(i, 8) * 40}><BuilderCard builder={b} /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

