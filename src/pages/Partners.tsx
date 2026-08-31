import { useEffect, useState } from 'react'
import { Handshake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Partner } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'

export default function Partners() {
  const [partners, setPartners] = useState<Partner[] | null>(null)

  useEffect(() => {
    supabase.from('partners').select('*').order('created_at', { ascending: false }).then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [])

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Partners</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-14 max-w-xl">Building this ecosystem together.</h1>
        </Reveal>

        <Reveal className="flex flex-wrap items-center gap-5 mb-4">
          <div className="flex items-center gap-2 px-6 py-4 rounded-full border border-white/15 font-display font-semibold">
            <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-glow to-purple" /> Monad
          </div>
        </Reveal>

        {partners === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-full border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : partners.length === 0 ? (
          <div className="mt-10">
            <EmptyState Icon={Handshake} message="No community partners listed yet." />
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 mt-6">
            {partners.map((p, i) => (
              <Reveal key={p.id} delay={i * 50}>
                <a href={p.website || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-6 py-4 rounded-full border border-white/15 hover:border-gold/40 hover:-translate-y-0.5 transition-all font-display font-semibold">
<<<<<<< HEAD
                  {p.logo_url ? <img src={p.logo_url} alt={p.name} className="w-6 h-6 rounded object-cover" /> : <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-glow to-purple" />}
=======
                  {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="w-6 h-6 rounded object-cover" /> : <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-glow to-purple" />}
>>>>>>> fix/password-reset-otp-admin-api
                  {p.name}
                </a>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
