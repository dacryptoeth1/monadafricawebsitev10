import { useEffect, useState } from 'react'
import { Search, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Bounty, BountyCategory, SiteSettings } from '../types'
import { defaultSiteSettings } from '../types'
import BountyCard from '../components/BountyCard'
import EmptyState from '../components/EmptyState'
import Reveal from '../components/Reveal'

const CATEGORIES: (BountyCategory | 'All')[] = ['All', 'Development', 'Design', 'Marketing', 'Community', 'Content']

export default function Bounties() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null)
  const [active, setActive] = useState<BountyCategory | 'All'>('All')
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)

  useEffect(() => {
    supabase
      .from('bounties')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(({ data }) => setBounties((data as Bounty[]) ?? []))
  }, [])

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SiteSettings)
    })
  }, [])

  const filtered = bounties
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
    }) ?? null

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Bounty board</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">Find your next opportunity.</h1>
          <p className="text-white/55 max-w-xl mb-10">Every bounty here has been reviewed and approved by the Monad Africa team.</p>
        </Reveal>

        <Reveal className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bounties, projects, skills…"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-64 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((b, i) => (
              <Reveal key={b.id} delay={Math.min(i, 6) * 60}><BountyCard bounty={b} /></Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
