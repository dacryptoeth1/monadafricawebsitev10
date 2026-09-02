import { useEffect, useMemo, useState } from 'react'
import { Search, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Bounty, BountyCategory } from '../types'
import { useSiteSettings } from '../hooks/useSiteSettings'
import BountyCard from '../components/BountyCard'
import EmptyState from '../components/EmptyState'
import Reveal from '../components/Reveal'
import { VerificationDisclaimer } from '../components/VerificationBadge'

const CATEGORIES: (BountyCategory | 'All')[] = ['All', 'Development', 'Design', 'Marketing', 'Community', 'Content']

export default function Bounties() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null)
  const [active, setActive] = useState<BountyCategory | 'All'>('All')
  const [search, setSearch] = useState('')
  const settings = useSiteSettings()

  useEffect(() => {
    supabase
      .from('bounties')
      .select('*')
      .eq('status', 'approved')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBounties((data as Bounty[]) ?? []))
  }, [])

  // Memoized so this list is only recomputed when its actual inputs
  // change, not on every unrelated re-render of the page — combined
  // with BountyCard now being memo()'d, typing in the search box no
  // longer re-renders every card in the grid on every keystroke.
  const filtered = useMemo(
    () =>
      bounties
        ?.filter((b) => active === 'All' || b.category === active)
        .filter((b) => {
          if (!search.trim()) return true
          const q = search.toLowerCase()
          return (
            b.title.toLowerCase().includes(q) ||
            b.project_name.toLowerCase().includes(q) ||
            (b.skills_needed || '').toLowerCase().includes(q) ||
            b.description.toLowerCase().includes(q)
          )
        }) ?? null,
    [bounties, active, search]
  )

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Opportunities</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">Find your next opportunity.</h1>
          <p className="text-white/55 max-w-xl mb-4">Bounties, grants, and paid work from across the Monad ecosystem — every one reviewed and approved by the Monad Africa team.</p>
          <VerificationDisclaimer className="max-w-xl mb-10" />
        </Reveal>

        <Reveal className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities, projects, skills…"
              className="input w-full pl-10"
            />
          </div>
        </Reveal>

        <Reveal className="flex flex-wrap gap-2 mb-12">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                active === c ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55 hover:bg-white/5'
              }`}
            >
              {c}
            </button>
          ))}
        </Reveal>

        {filtered === null ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid grid-cols-1">
            {active === 'All' && !search.trim() ? (
              <EmptyState
                Icon={Target}
                message={'No active bounties yet.\n\nJoin the Monad Africa community to get notified when new opportunities go live.'}
                actions={[
                  { label: 'Join Telegram', href: settings.telegram_url, external: true },
                  { label: 'Join Discord', href: settings.discord_url, external: true },
                  { label: 'Follow on X', href: settings.x_url, external: true },
                ]}
              />
            ) : (
              <EmptyState
                Icon={Target}
                message={search.trim() ? `No bounties match "${search}" — try a different search or category.` : `No approved ${active.toLowerCase()} bounties right now — check back soon or try another category.`}
                action={{ label: 'Host a Bounty', href: '/host-bounty' }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((b, i) => (
              <Reveal key={b.id} delay={Math.min(i, 6) * 50}><BountyCard bounty={b} variant="row" /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
