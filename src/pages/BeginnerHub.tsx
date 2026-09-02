import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Code2, PlayCircle, Wrench, Wallet, ArrowLeftRight, Coins, Hammer, FileText, HelpCircle, ChevronDown, Compass, Users2, Layers, Boxes, Image, Landmark } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Resource, Video } from '../types'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'

// The "I'm new here, what do I do?" path — each step deliberately links
// to a real, existing page rather than staying abstract, so a beginner
// can act on it immediately instead of just reading about it.
const ROADMAP = [
  { step: '01', title: 'Understand Monad', desc: 'What Monad is and why parallel execution matters — the video below is the fastest way in.' },
  { step: '02', title: 'Set up your wallet', desc: 'Get a wallet connected and comfortable with Monad testnet before touching real funds.', to: 'https://docs.monad.xyz', external: true },
  { step: '03', title: 'Learn the basics', desc: 'Wallets, gas, tokens, DeFi, NFTs, DAOs — the glossary below covers the terms you\'ll keep running into.' },
  { step: '04', title: 'Explore the ecosystem', desc: 'See what\'s actually being built on Monad, and where the African community is based.', to: '/explore' },
  { step: '05', title: 'Join the community', desc: 'Discord, Telegram, and X — where builders ask questions and find each other.', to: '/community' },
  { step: '06', title: 'Find an opportunity', desc: 'Bounties, grants, and paid work — apply what you\'ve learned to something real.', to: '/opportunities' },
]

// Plain-language explanations of the terms beginners run into most —
// generic Web3 concepts, not Monad-specific claims, so nothing here
// needs a source citation the way an ecosystem statistic would.
const BASICS = [
  { icon: Wallet, term: 'Wallet', desc: 'An app (like MetaMask or Rabby) that holds your keys and lets you sign transactions — think of it as your login and your bank account in one.' },
  { icon: Layers, term: 'Network / Chain', desc: 'A blockchain like Monad is a shared, public computer — everyone sees the same transactions and the same state.' },
  { icon: Coins, term: 'Gas', desc: 'The small fee paid to the network for processing a transaction — it\'s what pays for your action to actually happen on-chain.' },
  { icon: ArrowLeftRight, term: 'Transaction', desc: 'Any action you take on-chain — sending tokens, swapping, minting — that gets recorded permanently once confirmed.' },
  { icon: Boxes, term: 'Token', desc: 'A digital asset on the network — could be a currency, a governance vote, or a point system, depending on the project.' },
  { icon: Landmark, term: 'DeFi', desc: 'Decentralized Finance — lending, trading, and earning built directly on-chain, without a bank in the middle.' },
  { icon: Image, term: 'NFT', desc: 'A unique, ownable digital item — art, a collectible, a membership pass — recorded on-chain so ownership is verifiable.' },
  { icon: Users2, term: 'DAO', desc: 'A Decentralized Autonomous Organization — a group that makes decisions together on-chain, often by token-holder vote.' },
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
            <Code2 size={20} className="text-purple-light" /> Your Path, Step by Step
          </h2>
          <div className="relative max-w-2xl">
            {/* Connecting line down the left edge — the "visual roadmap"
                feel, not just a grid of disconnected boxes. */}
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-purple/40 via-purple/20 to-transparent" aria-hidden="true" />
            <div className="flex flex-col gap-6">
              {ROADMAP.map((r, i) => {
                const content = (
                  <>
                    <div className="w-10 h-10 rounded-full border border-purple/40 bg-panel flex items-center justify-center font-mono text-xs font-semibold text-purple-light shrink-0 z-10">
                      {i + 1}
                    </div>
                    <div className="min-w-0 pt-1.5">
                      <h3 className="font-display font-semibold text-lg mb-1">{r.title}</h3>
                      <p className="text-white/55 text-sm leading-relaxed">{r.desc}</p>
                    </div>
                  </>
                )
                const rowClass = 'flex items-start gap-4'
                if (!('to' in r) || !r.to) return <div key={r.step} className={rowClass}>{content}</div>
                return r.external ? (
                  <a key={r.step} href={r.to} target="_blank" rel="noopener noreferrer" className={`${rowClass} group`}>
                    {content}
                  </a>
                ) : (
                  <Link key={r.step} to={r.to} className={`${rowClass} group`}>
                    {content}
                  </Link>
                )
              })}
            </div>
          </div>
        </Reveal>

        <Reveal className="mb-24">
          <h2 className="font-display font-semibold text-2xl mb-2 flex items-center gap-2">
            <BookOpen size={20} className="text-purple-light" /> Web3 Basics
          </h2>
          <p className="text-white/50 text-sm mb-8 max-w-lg">The terms you'll keep seeing — explained simply, once, so you don't have to guess.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {BASICS.map((b) => (
              <div key={b.term} className="rounded-squircle border border-white/10 bg-white/[0.02] p-5">
                <b.icon size={16} className="text-purple-light mb-3" />
                <h3 className="font-display font-semibold text-sm mb-1.5">{b.term}</h3>
                <p className="text-white/50 text-xs leading-relaxed">{b.desc}</p>
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

        {/* Closes the loop — a beginner who just finished reading has
            somewhere real to go next, not a dead end. */}
        <Reveal className="mt-24">
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-purple/10 via-panel to-ink p-10 md:p-14 text-center">
            <span className="font-mono text-xs uppercase tracking-wider text-purple-light flex items-center justify-center gap-2 mb-4">
              <Compass size={14} /> Ready to go further?
            </span>
            <h2 className="font-display font-semibold text-2xl md:text-3xl mb-8 max-w-lg mx-auto">You've got the basics — here's where Monad Africa takes you next.</h2>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/explore" className="px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform">
                Explore the Ecosystem →
              </Link>
              <Link to="/opportunities" className="px-5 py-3 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                Find Opportunities →
              </Link>
              <Link to="/events" className="px-5 py-3 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                See Events →
              </Link>
              <Link to="/community" className="px-5 py-3 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors">
                Join the Community →
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
