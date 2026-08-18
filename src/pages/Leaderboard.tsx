import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getRank } from '../lib/rank'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'
import EmptyState from '../components/EmptyState'
import ReportButton from '../components/ReportButton'
import type { PublicProfile } from '../types'

const MEDALS = ['🥇', '🥈', '🥉']
const TOP_N = 50

// Public by design: reads `leaderboard_public` (migration 0032), not
// `profiles` directly — `profiles` only ever lets a row's owner or an
// admin read it, so a plain visitor (or any non-admin user reading
// someone else's row) always got 0 rows back from this page before
// that view existed. No auth required to view this page or its data.
export default function Leaderboard() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<PublicProfile[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The signed-in visitor's exact rank, even when they're outside the
  // top N shown below — a separate lightweight count query so the page
  // doesn't need to fetch every row just to answer "where am I".
  const [myRank, setMyRank] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('leaderboard_public')
      .select('id, username, full_name, avatar_url, country, xp, total_referrals')
      .order('xp', { ascending: false })
      .limit(TOP_N)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setLoadError(error.message); setUsers([]); return }
        setUsers((data as PublicProfile[]) ?? [])
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!profile) { setMyRank(null); return }
    let cancelled = false
    supabase
      .from('leaderboard_public')
      .select('id', { count: 'exact', head: true })
      .gt('xp', profile.xp)
      .then(({ count, error }) => {
        if (cancelled || error) return
        setMyRank((count ?? 0) + 1)
      })
    return () => { cancelled = true }
  }, [profile?.id, profile?.xp])

  const inTopList = !!profile && !!users?.some((u) => u.id === profile.id)

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal className="text-center mb-10">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Ranked by XP</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4">🏆 African Leaderboard</h1>
          <p className="text-white/55 mt-4 max-w-lg mx-auto">
            Earned by submitting bounties, winning them, referring builders, and completing
            your profile — updates automatically as the community builds.
          </p>
        </Reveal>

        {/* Own-rank banner: only when signed in and not already visible
            in the top-N list below, so it adds information instead of
            repeating what's already on screen. */}
        {profile && myRank !== null && !inTopList && (
          <Reveal className="mb-8">
            <div className="flex items-center gap-4 rounded-2xl border border-purple/40 bg-purple/10 p-4">
              <div className="w-9 text-center font-display font-semibold text-lg shrink-0">#{myRank}</div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-xs font-bold">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (profile.username || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{profile.full_name || profile.username || 'You'}</div>
                <div className="text-white/40 text-xs">Your current rank</div>
              </div>
              <div className="font-display font-semibold text-sm text-purple-light shrink-0">{profile.xp} XP</div>
            </div>
          </Reveal>
        )}

        {users === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
          </div>
        ) : loadError ? (
          <div className="text-center py-14">
            <p className="text-rose-300 text-sm mb-1">Couldn't load the leaderboard right now.</p>
            <p className="text-white/40 text-xs">{loadError}</p>
          </div>
        ) : users.length === 0 ? (
          <EmptyState Icon={Trophy} message="No builders on the leaderboard yet — be the first to earn XP." />
        ) : (
          <Reveal className="flex flex-col gap-2">
            {users.map((u, i) => {
              const isMe = profile?.id === u.id
              return (
                <div
                  key={u.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${
                    isMe
                      ? 'border-purple/50 bg-purple/10'
                      : i < 3
                      ? 'border-gold/30 bg-gradient-to-r from-gold/10 to-transparent'
                      : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <div className="w-9 text-center font-display font-semibold text-lg shrink-0">
                    {i < 3 ? MEDALS[i] : `${i + 1}`}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-xs font-bold">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (u.username || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">
                      {u.full_name || u.username || 'Unnamed'}{isMe && <span className="ml-2 text-[10px] font-mono uppercase text-purple-light align-middle">You</span>}
                    </div>
                    <div className="text-white/40 text-xs">{u.country || '—'} · {getRank(u.xp).emoji} {getRank(u.xp).name}</div>
                  </div>
                  <div className="font-display font-semibold text-sm text-purple-light shrink-0">{u.xp} XP</div>
                  {!isMe && <ReportButton targetType="user" targetId={u.id} className="shrink-0" />}
                </div>
              )
            })}
          </Reveal>
        )}
      </div>
    </section>
  )
}
