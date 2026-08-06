import { useEffect, useState } from 'react'
import { BookOpen, Code2, PlayCircle, Wrench, Wallet, ArrowLeftRight, Coins, Hammer, FileText, HelpCircle, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Resource, Video } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'

const ROADMAP = [
  { step: '01', title: 'Understand the basics', desc: 'Start with what Monad is and why parallel execution matters — the video below is the fastest way in.' },
  { step: '02', title: 'Set up your environment', desc: 'Get comfortable with the Monad docs, testnet, and developer tooling.' },
  { step: '03', title: 'Ship something small', desc: 'Build a tiny project — even a script that reads on-chain data counts.' },
  { step: '04', title: 'Take on a bounty', desc: 'Apply what you\'ve learned to a real, paid opportunity from the bounty board.' },
]

const CORE_TOPICS = [
  { icon: Code2, title: 'What is Monad', desc: 'The fundamentals — parallel execution, EVM compatibility, and why it matters.', href: 'https://docs.monad.xyz' },
  { icon: Wallet, title: 'Wallet Guide', desc: 'Setting up a wallet and connecting it to Monad testnet.', href: 'https://docs.monad.xyz' },
  { icon: ArrowLeftRight, title: 'Bridge Guide', desc: 'Moving assets onto Monad from other chains.', href: 'https://docs.monad.xyz' },
  { icon: Coins, title: 'Getting Testnet MON', desc: 'Where to find a faucet and get testnet funds for development.', href: 'https://docs.monad.xyz' },
  { icon: Hammer, title: 'Build Your First dApp', desc: 'A hands-on walkthrough for shipping your first contract and frontend.', href: 'https://docs.monad.xyz' },
  { icon: FileText, title: 'Developer Docs', desc: 'The complete technical reference for building on Monad.', href: 'https://docs.monad.xyz' },
]

const FAQS = [
  { q: 'Do I need Solidity experience to start?', a: 'No — Monad is EVM-compatible, so existing Solidity knowledge transfers directly, but the Beginner Hub above is designed for people starting from zero.' },
  { q: 'Is testnet MON worth real money?', a: 'No. Testnet tokens have no monetary value and exist purely for development and testing.' },
  { q: 'How do I get involved with Monad Africa specifically?', a: 'Join our Discord and Telegram, follow bounties on the Bounty Board, and apply to any that match your skills.' },
  { q: 'I\'m stuck — where do I ask for help?', a: 'The Monad Africa Discord is the fastest way to reach both the community and the team.' },
]

export default function BeginnerHub() {
  const [resources, setResources] = useState<Resource[] | null>(null)
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('resources').select('*').order('created_at', { ascending: false }).then(({ data }) => setResources((data as Resource[]) ?? []))
    supabase.from('videos').select('*').order('created_at', { ascending: false }).then(({ data }) => setVideos((data as Video[]) ?? []))
  }, [])

  return (
    <section className="pt-36 pb-28">
      <div className="max-w-5xl mx-auto px-6">
        <Reveal className="text-center mb-16">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">New to Monad? Start here</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-5">Beginner Hub</h1>
          <p className="text-white/55 max-w-xl mx-auto leading-relaxed">
            No blockchain background required — everything you need to go from curious to
            shipping on Monad.
          </p>
        </Reveal>

        {/* Kept as requested: the beginners explainer video */}
        <Reveal delay={100} className="mb-24">
          <div className="rounded-squircle overflow-hidden border border-white/10 shadow-[0_24px_70px_-24px_rgba(110,84,255,0.4)] aspect-video max-w-3xl mx-auto">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/id0UWrKpn80"
              title="What is the Monad Blockchain? Explained Simply"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </Reveal>

        <Reveal className="mb-24">
          <h2 className="font-display font-semibold text-2xl mb-8 flex items-center gap-2">
            <BookOpen size={20} className="text-purple-light" /> Core Topics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE_TOPICS.map((t) => (
              <a key={t.title} href={t.href} target="_blank" rel="noopener noreferrer" className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 hover:border-purple/40 hover:-translate-y-1 transition-all">
                <t.icon size={18} className="text-purple-light mb-3" />
                <h3 className="font-display font-semibold mb-1">{t.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{t.desc}</p>
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal className="mb-24">
          <h2 className="font-display font-semibold text-2xl mb-8 flex items-center gap-2">
            <Code2 size={20} className="text-purple-light" /> Learning Roadmap
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ROADMAP.map((r) => (
              <div key={r.step} className="rounded-squircle border border-white/10 bg-white/[0.02] p-6">
                <span className="font-mono text-xs text-purple-light">{r.step}</span>
                <h3 className="font-display font-semibold text-lg mt-2 mb-1">{r.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mb-24">
          <h2 className="font-display font-semibold text-2xl mb-8 flex items-center gap-2">
            <Wrench size={20} className="text-purple-light" /> Documentation &amp; Developer Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a href="https://docs.monad.xyz" target="_blank" rel="noopener noreferrer" className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 hover:border-gold/40 hover:-translate-y-1 transition-all">
              <Wrench size={18} className="text-gold mb-3" />
              <h3 className="font-display font-semibold mb-1">Monad Documentation</h3>
              <p className="text-white/55 text-sm">The official technical docs for building on Monad.</p>
            </a>
            {resources === null ? (
              <div className="h-32 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />
            ) : resources.length === 0 ? null : (
              resources.map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 hover:border-gold/40 hover:-translate-y-1 transition-all">
                  <Wrench size={18} className="text-gold mb-3" />
                  <h3 className="font-display font-semibold mb-1">{r.title}</h3>
                  <p className="text-white/55 text-sm">{r.description}</p>
                </a>
              ))
            )}
          </div>
        </Reveal>

        <Reveal className="mb-24">
          <h2 className="font-display font-semibold text-2xl mb-8 flex items-center gap-2">
            <PlayCircle size={20} className="text-purple-light" /> More Videos
          </h2>
          {videos === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1].map((i) => <div key={i} className="h-40 rounded-squircle border border-white/10 bg-white/[0.02] animate-pulse" />)}
            </div>
          ) : videos.length === 0 ? (
            <EmptyState Icon={PlayCircle} message="More community and tutorial videos will appear here as the Monad Africa team adds them." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videos.map((v) => (
                <div key={v.id} className="rounded-squircle overflow-hidden border border-white/10 aspect-video">
                  <iframe className="w-full h-full" src={v.youtube_url} title={v.title} loading="lazy" allowFullScreen />
                </div>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal>
          <h2 className="font-display font-semibold text-2xl mb-8 flex items-center gap-2">
            <HelpCircle size={20} className="text-purple-light" /> FAQ
          </h2>
          <div className="flex flex-col gap-3 max-w-2xl">
            {FAQS.map((f, i) => (
              <div key={f.q} className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                >
                  <span className="font-medium text-sm">{f.q}</span>
                  <ChevronDown size={16} className={`text-white/40 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-4 text-white/55 text-sm leading-relaxed">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
