import { useEffect, useState } from 'react'
import { Boxes } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { EcosystemProject } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'

export default function Ecosystem() {
  const [projects, setProjects] = useState<EcosystemProject[] | null>(null)

  useEffect(() => {
    supabase.from('projects').select('*').order('created_at', { ascending: false }).then(({ data }) => setProjects((data as EcosystemProject[]) ?? []))
  }, [])

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Ecosystem</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-14 max-w-xl">What's being built on Monad.</h1>
        </Reveal>

        {projects === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-48 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState Icon={Boxes} message="No featured ecosystem projects yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p, i) => {
              const body = (
                <>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden mb-5">
                    {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" /> : <span className="font-display font-bold text-sm">{p.name.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-2">{p.name}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{p.description}</p>
                  {p.category && <span className="inline-block mt-4 text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">{p.category}</span>}
                </>
              )
              // A project with no website renders as a plain card, not an
              // anchor to "#" that looks clickable and goes nowhere.
              const base = 'block rounded-squircle border border-white/10 bg-white/[0.02] p-7 h-full'
              return (
                <Reveal key={p.id} delay={i * 60}>
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
    </section>
  )
}
