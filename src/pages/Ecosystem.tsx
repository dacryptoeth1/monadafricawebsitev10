import { useEffect, useState } from 'react'
import { Boxes } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { EcosystemProject } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'
import ProjectCard from '../components/ProjectCard'

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
            {projects.map((p, i) => (
              <Reveal key={p.id} delay={i * 60}>
                <ProjectCard project={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
