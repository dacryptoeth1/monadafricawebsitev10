import { useEffect, useState } from 'react'
import { CalendarDays, MessageCircle, Send, Star } from 'lucide-react'
<<<<<<< HEAD
import { supabase } from '../lib/supabase'
import type { SiteSettings } from '../types'
import { defaultSiteSettings } from '../types'
=======
import { fetchDiscordWidget } from '../lib/discordWidget'
import { useSiteSettings } from '../hooks/useSiteSettings'
>>>>>>> fix/password-reset-otp-admin-api
import Reveal from '../components/Reveal'
import Counter from '../components/Counter'

export default function Community() {
<<<<<<< HEAD
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SiteSettings)
    })
  }, [])
=======
  const settings = useSiteSettings()
  const [liveDiscord, setLiveDiscord] = useState<{ members: number; online: number } | null>(null)

  useEffect(() => {
    if (!settings.discord_widget_enabled || !settings.discord_guild_id) {
      setLiveDiscord(null)
      return
    }
    fetchDiscordWidget(settings.discord_guild_id).then((w) => {
      setLiveDiscord(w ? { members: w.members.length, online: w.presence_count } : null)
    })
  }, [settings.discord_widget_enabled, settings.discord_guild_id])

  const discordMembers = liveDiscord?.members ?? settings.discord_members
  const discordOnline = liveDiscord?.online ?? settings.discord_online_manual
  const discordIsLive = liveDiscord !== null
  const totalCommunity = settings.x_followers + settings.telegram_members + discordMembers
>>>>>>> fix/password-reset-otp-admin-api

  const channels = [
    { icon: MessageCircle, title: 'Discord', desc: 'Where the community lives day to day.', href: settings.discord_url },
    { icon: Star, title: 'X (Twitter)', desc: 'Announcements, threads, and Spaces.', href: settings.x_url },
    { icon: Send, title: 'Telegram', desc: settings.telegram_url ? 'Quick updates and discussion.' : 'Coming soon.', href: settings.telegram_url || undefined },
  ]

  return (
    <section className="pt-36 pb-28">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Community</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-14 max-w-xl">Join the Monad Africa Community</h1>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-20">
          {channels.map((c, i) => (
            <Reveal key={c.title} delay={i * 70}>
              {c.href ? (
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="block rounded-squircle border border-white/10 bg-white/[0.02] p-7 h-full hover:border-purple/40 hover:-translate-y-1 transition-all">
                  <c.icon size={20} className="text-purple-light mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-1">{c.title}</h3>
                  <p className="text-white/50 text-sm">{c.desc}</p>
                </a>
              ) : (
                <div className="rounded-squircle border border-dashed border-white/15 p-7 h-full opacity-60">
                  <c.icon size={20} className="text-white/40 mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-1">{c.title}</h3>
                  <p className="text-white/50 text-sm">{c.desc}</p>
                </div>
              )}
            </Reveal>
          ))}
        </div>

<<<<<<< HEAD
        <Reveal className="grid grid-cols-2 md:grid-cols-5 gap-5 mb-20">
          {[
            ['X Followers', settings.x_followers],
            ['Discord Members', settings.discord_members],
            ['Countries Reached', settings.countries_reached],
            ['Builders Onboarded', settings.builders_onboarded],
            ['Partners', settings.community_partners],
=======
        <Reveal className="mb-4">
          <h2 className="font-display font-semibold text-2xl">Community Dashboard</h2>
        </Reveal>
        <Reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            emoji="🐦"
            platform="X"
            live={false}
            primary={settings.x_followers}
            primaryLabel="Followers"
            delta={`+${settings.x_followers_change_week} this week`}
          />
          <StatCard
            emoji="💬"
            platform="Telegram"
            live={false}
            primary={settings.telegram_members}
            primaryLabel="Members"
            delta={`+${settings.telegram_members_change_today} today`}
          />
          <StatCard
            emoji="🎮"
            platform="Discord"
            live={discordIsLive}
            primary={discordMembers}
            primaryLabel="Members"
            delta={`${discordOnline} Online`}
          />
          <StatCard
            emoji="👥"
            platform="Total Community"
            live={discordIsLive}
            primary={totalCommunity}
            primaryLabel="Members"
            delta="Across X, Telegram & Discord"
          />
        </Reveal>
        <Reveal className="mb-20">
          <p className="text-white/30 text-xs font-mono">
            {discordIsLive
              ? 'Discord numbers are live, pulled directly from Discord\u2019s public widget. '
              : 'Discord numbers are manually updated by the team (live widget not enabled). '}
            X and Telegram don't have a safe way to fetch live counts from the browser without exposing private API credentials, so those stay manually updated too — kept accurate by the team, refreshed regularly.
          </p>
        </Reveal>

        <Reveal className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-20">
          {[
            ['Countries Reached', settings.countries_reached],
            ['Builders Onboarded', settings.builders_onboarded],
            ['Community Partners', settings.community_partners],
>>>>>>> fix/password-reset-otp-admin-api
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-squircle border border-white/10 bg-gradient-to-b from-purple/10 to-transparent p-6 text-center">
              <div className="font-display font-semibold text-2xl"><Counter value={value as number} suffix="+" /></div>
              <div className="text-white/50 text-xs mt-2">{label}</div>
            </div>
          ))}
        </Reveal>

        <Reveal>
          <div className="rounded-squircle border border-white/10 bg-panel/40 p-10 flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple/10 border border-purple/25 flex items-center justify-center">
                <CalendarDays size={20} className="text-purple-light" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-lg">Ambassador Program</h3>
                <p className="text-white/50 text-sm mt-1">Represent Monad Africa in your city — apply through Discord or Contact.</p>
              </div>
            </div>
            <a href={settings.discord_url} target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple text-sm">
              Learn More
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
<<<<<<< HEAD
=======

function StatCard({
  emoji,
  platform,
  live,
  primary,
  primaryLabel,
  delta,
}: {
  emoji: string
  platform: string
  live: boolean
  primary: number
  primaryLabel: string
  delta: string
}) {
  return (
    <div className="rounded-squircle border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold flex items-center gap-2">
          <span>{emoji}</span> {platform}
        </span>
        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${live ? 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10' : 'text-white/40 border-white/15'}`}>
          {live ? 'Live' : 'Manual'}
        </span>
      </div>
      <div className="font-display font-semibold text-2xl"><Counter value={primary} /></div>
      <div className="text-white/40 text-xs mt-1">{primaryLabel}</div>
      <div className="text-purple-light text-xs font-mono mt-3">{delta}</div>
    </div>
  )
}
>>>>>>> fix/password-reset-otp-admin-api
