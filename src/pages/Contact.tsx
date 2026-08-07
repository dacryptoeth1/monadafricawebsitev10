import { Mail, MessageCircle } from 'lucide-react'
import Reveal from '../components/Reveal'
import { defaultSiteSettings } from '../types'

export default function Contact() {
  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Contact</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-5">Let's talk.</h1>
          <p className="text-white/55 leading-relaxed mb-12 max-w-md mx-auto">
            For partnerships, press, or anything else — reach us directly.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="mailto:africamonad@gmail.com" className="rounded-squircle border border-white/10 bg-white/[0.02] p-8 hover:border-purple/40 hover:-translate-y-1 transition-all">
            <Mail size={22} className="mx-auto mb-4 text-purple-light" />
            <h3 className="font-display font-semibold mb-1">Email</h3>
            <p className="text-white/50 text-sm">africamonad@gmail.com</p>
          </a>
          <a href={defaultSiteSettings.discord_url} target="_blank" rel="noopener noreferrer" className="rounded-squircle border border-white/10 bg-white/[0.02] p-8 hover:border-purple/40 hover:-translate-y-1 transition-all">
            <MessageCircle size={22} className="mx-auto mb-4 text-purple-light" />
            <h3 className="font-display font-semibold mb-1">Discord</h3>
            <p className="text-white/50 text-sm">Fastest way to reach the team</p>
          </a>
        </Reveal>
      </div>
    </section>
  )
}
