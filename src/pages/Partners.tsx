import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Handshake, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Partner, TeamMember } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'
import { initialsFor } from '../components/TeamMemberCard'

export default function Partners() {
  const [partners, setPartners] = useState<Partner[] | null>(null)
  // undefined = still loading, null = loaded but no BD lead set.
  const [bdLead, setBdLead] = useState<TeamMember | null | undefined>(undefined)

  useEffect(() => {
    supabase.from('partners').select('*').order('created_at', { ascending: false }).then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [])

  useEffect(() => {
    // Same source Team.tsx's own Business Development section reads
    // (is_bd_lead on team_members) — the sole BD/partnership contact,
    // whoever an admin has flagged there. No hardcoded name.
    supabase
      .from('team_members')
      .select('*')
      .eq('is_bd_lead', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setBdLead((data as TeamMember) ?? null))
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
                  {p.logo_url ? <img src={p.logo_url} alt={p.name} loading="lazy" className="w-6 h-6 rounded object-cover" /> : <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-glow to-purple" />}
                  {p.name}
                </a>
              </Reveal>
            ))}
          </div>
        )}

        {/* Separate from the partner-logo showcase above — this is the
            BD/partnership contact section for projects, protocols,
            startups, creators, communities, organizations, brands and
            ecosystem teams who want to work with Monad Africa, not a
            place to browse existing partners. */}
        <div className="mt-24 pt-24 border-t border-white/10">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-wider text-gold">Work with us</span>
            <h2 className="font-display font-semibold text-3xl md:text-4xl mt-4 mb-4 max-w-xl">Partner with Monad Africa</h2>
            <p className="text-white/55 max-w-xl mb-10 leading-relaxed">
              Building something you'd like to bring to the African Monad community? Connect with
              our BD team for partnerships, collaborations, integrations, and ecosystem opportunities.
            </p>
          </Reveal>

          {bdLead === undefined ? (
            <div className="h-40 rounded-[32px] border border-white/10 bg-white/[0.02] animate-pulse" />
          ) : bdLead ? (
            <Reveal>
              <div className="relative rounded-[32px] border border-gold/40 bg-gradient-to-br from-gold/10 via-panel to-ink p-8 md:p-12 overflow-hidden">
                <div className="absolute -z-10 w-[400px] h-[400px] bg-gold/20 rounded-full blur-[110px] -top-32 -right-20" />
                <div className="flex flex-col md:flex-row md:items-center gap-8">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-2xl font-display font-bold">
                    {bdLead.avatar_url ? (
                      <img src={bdLead.avatar_url} alt={bdLead.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      initialsFor(bdLead.name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-gold/40 text-gold mb-2">
                      Primary Contact for Partnerships
                    </span>
                    <h3 className="font-display font-semibold text-2xl mb-1">{bdLead.name}</h3>
                    <p className="text-purple-light font-medium">{bdLead.primary_role}</p>
                  </div>
                  {(bdLead.telegram_url || bdLead.x_url) && (
                    <a
                      href={bdLead.telegram_url || bdLead.x_url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold bg-gradient-to-br from-gold to-sunset-amber text-ink hover:-translate-y-0.5 transition-transform whitespace-nowrap w-full md:w-auto shrink-0"
                    >
                      <Send size={15} /> Contact BD
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          ) : (
            <p className="text-white/40 text-sm">BD contact details will appear here once set.</p>
          )}

          <Reveal className="mt-8">
            <Link to="/partner" className="inline-flex items-center gap-2 text-sm font-semibold text-purple-light hover:text-white transition-colors">
              Have a partnership proposal? Submit it here →
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
