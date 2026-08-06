import { Code2, GraduationCap, Palette, Rocket, Sparkles, Users2 } from 'lucide-react'
import Reveal from '../components/Reveal'
import { ContourLines } from '../components/PatternBackground'

const AUDIENCE = [
  { icon: Code2, title: 'Builders & Developers', desc: 'Engineers shipping real products on Monad, from smart contracts to full-stack apps.' },
  { icon: Palette, title: 'Creators & Designers', desc: 'Visual and content creators shaping how the ecosystem looks and communicates.' },
  { icon: GraduationCap, title: 'Students', desc: 'The next generation learning Web3 fundamentals and getting their first real experience.' },
  { icon: Rocket, title: 'Founders', desc: 'Early-stage builders launching their own projects on top of Monad.' },
  { icon: Users2, title: 'Communities', desc: 'Local tech communities and hubs across the continent, connected into one network.' },
  { icon: Sparkles, title: 'Ambassadors', desc: 'Advocates representing Monad Africa in their own cities and countries.' },
]

export default function About() {
  return (
    <section className="pt-36 pb-28 relative">
      <ContourLines className="absolute top-0 left-0 w-full h-40 -z-10 text-purple/20" />
      <div className="max-w-5xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">About Monad Africa</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-6 max-w-2xl">
            Empowering African builders into the Monad ecosystem.
          </h1>
          <p className="text-white/60 text-lg leading-relaxed max-w-2xl mb-16">
            Monad Africa exists to create real opportunity — through bounties, education,
            events, partnerships, hackathons, and community — for the people already building
            the future of Web3 across the continent.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.title} delay={i * 60}>
              <div className="rounded-squircle border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-7 h-full hover:border-purple/30 hover:-translate-y-1 transition-all">
                <div className="w-11 h-11 rounded-xl bg-purple/10 border border-purple/25 flex items-center justify-center mb-5">
                  <a.icon size={18} className="text-purple-light" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{a.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{a.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
