import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getRank } from '../lib/rank'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'
import ReportButton from '../components/ReportButton'

const MEDALS = ['🥇', '🥈', '🥉']

// Only the columns this public page actually renders — the leaderboard
// used to select('*'), which meant wallet address, email, bio, and
// other private fields were shipped to every visitor's browser just to
// render a username and an XP number.
interface LeaderboardUser {
  id: string
  avatar_url: string | null
  username: string | null
  full_name: string | null
  country: string | null
  xp: number
}

export default function Leaderboard() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<LeaderboardUser[] | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, avatar_url, username, full_name, country, xp')
      .eq('hide_from_leaderboard', false)
      .order('xp', { ascending: false })
      .limit(50)
      .then(({ data }) => setUsers((data as LeaderboardUser[]) ?? []))
  }, [])

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal className="text-center mb-14">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Ranked by XP</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4">🏆 African Leaderboard</h1>
          <p className="text-white/55 mt-4 max-w-lg mx-auto">
            Earned by submitting bounties, winning them, referring builders, and completing
            your profile — updates automatically as the community builds.
          </p>
        </Reveal>

        {users === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState Icon={Trophy} message="No builders on the leaderboard yet — be the first to earn XP." />
        ) : (
          <Reveal className="flex flex-col gap-2">
            {users.map((u, i) => (
              <div
                key={u.id}
                className={`flex items-center gap-4 rounded-2xl border p-4 ${
                  i < 3 ? 'border-gold/30 bg-gradient-to-r from-gold/10 to-transparent' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <div className="w-9 text-center font-display font-semibold text-lg shrink-0">
                  {i < 3 ? MEDALS[i] : `${i + 1}`}
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-xs font-bold">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (u.username || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{u.full_name || u.username || 'Unnamed'}</div>
                  <div className="text-white/40 text-xs">{u.country || '—'} · {getRank(u.xp).emoji} {getRank(u.xp).name}</div>
                </div>
                <div className="font-display font-semibold text-sm text-purple-light shrink-0">{u.xp} XP</div>
                {u.id !== profile?.id && <ReportButton targetType="user" targetId={u.id} className="shrink-0" />}
              </div>
            ))}
          </Reveal>
        )}
      </div>
    </section>
  )
}
