import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Send, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { TeamMember } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'
import TeamMemberCard, { initialsFor } from '../components/TeamMemberCard'

export default function Team() {
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const location = useLocation()

  useEffect(() => {
    supabase
      .from('team_members')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => setMembers((data as TeamMember[]) ?? []))
  }, [])

  // Supports footer/nav links like /team#business-development landing
  // directly on this section — the browser can't auto-scroll to an
  // anchor that doesn't exist yet at initial paint in a client-rendered
  // SPA, so this does it manually once the section has rendered.
  useEffect(() => {
    if (location.hash !== '#business-development') return
    const el = document.getElementById('business-development')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, members])

  const bdLead = members?.find((m) => m.is_bd_lead) ?? null
  const others = members?.filter((m) => !m.is_bd_lead) ?? []

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Team</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-5 max-w-2xl">
            The people building Monad Africa.
          </h1>
          <p className="text-white/55 max-w-xl leading-relaxed mb-16">
            Meet the official Monad Africa team. For partnerships, sponsorships, and collaborations, our
            Business Development lead is below.
          </p>
        </Reveal>

        {members === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : members.length === 0 ? (
          <EmptyState Icon={Users} message="Team profiles are being set up — check back soon." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-24">
            {members.map((m, i) => (
              <Reveal key={m.id} delay={i * 60}>
                <TeamMemberCard member={m} highlight={m.is_bd_lead} />
              </Reveal>
            ))}
          </div>
        )}

        <BusinessDevelopmentSection bdLead={bdLead} others={others} loading={members === null} />
      </div>
    </section>
  )
}

function BusinessDevelopmentSection({
  bdLead,
  others,
  loading,
}: {
  bdLead: TeamMember | null
  others: TeamMember[]
  loading: boolean
}) {
  if (loading) return null

  return (
    <div id="business-development" className="scroll-mt-28">
      <Reveal>
        <span className="font-mono text-xs uppercase tracking-wider text-gold">Business Development</span>
        <h2 className="font-display font-semibold text-3xl md:text-4xl mt-4 mb-10 max-w-xl">
          Partnerships, sponsorships & collaborations.
        </h2>
      </Reveal>

      {bdLead && (
        <Reveal>
          <div className="relative rounded-[32px] border border-gold/40 bg-gradient-to-br from-gold/10 via-panel to-ink p-8 md:p-12 mb-8 overflow-hidden">
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
                <p className="text-purple-light font-medium mb-3">{bdLead.primary_role}</p>
                <p className="text-white/60 text-sm leading-relaxed max-w-xl">
                  {bdLead.bio || 'Primary contact for partnerships, collaborations, sponsorships and ecosystem opportunities.'}
                </p>
                <p className="text-white/40 text-xs mt-3 leading-relaxed max-w-xl">
                  Handles ecosystem partnerships, sponsorships, collaborations, project proposals, events,
                  hackathons, university partnerships, and strategic outreach.
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
                {bdLead.telegram_url && (
                  <a
                    href={bdLead.telegram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold bg-gradient-to-br from-gold to-sunset-amber text-ink hover:-translate-y-0.5 transition-transform whitespace-nowrap"
                  >
                    <Send size={15} /> Contact Lead BD
                  </a>
                )}
                {bdLead.x_url && (
                  <a
                    href={bdLead.x_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors whitespace-nowrap"
                  >
                    𝕏 Follow on X
                  </a>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {others.length > 0 && (
        <Reveal>
          <p className="text-white/40 text-sm mb-4">Also on the partnerships team:</p>
          <div className="flex flex-wrap gap-4">
            {others.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.02] pl-2 pr-5 py-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden text-xs font-display font-bold shrink-0">
                  {m.avatar_url ? <img src={m.avatar_url} alt={m.name} loading="lazy" className="w-full h-full object-cover" /> : initialsFor(m.name)}
                </div>
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-white/40 text-xs">{m.primary_role}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal className="mt-10">
        <Link
          to="/partner"
          className="inline-flex items-center gap-2 text-sm font-semibold text-purple-light hover:text-white transition-colors"
        >
          Have a partnership proposal? Submit it here →
        </Link>
      </Reveal>
    </div>
  )
}
