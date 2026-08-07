import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import type { Profile } from '../../types'
import { getRank } from '../../lib/rank'

const TOP_N_OPTIONS = [10, 25, 50, 100]

export default function AdminLeaderboardView({ showToast }: { showToast: (msg: string) => void }) {
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [topN, setTopN] = useState(25)

  async function load() {
    const { data, error } = await supabase.from('profiles').select('*').order('xp', { ascending: false }).limit(topN)
    if (error) { showToast(error.message); setUsers([]); return }
    setUsers((data as Profile[]) ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topN])

  async function toggleHidden(user: Profile) {
    const ok = await runAdminAction(
      () => supabase.from('profiles').update({ hide_from_leaderboard: !user.hide_from_leaderboard }).eq('id', user.id),
      showToast,
      { successMessage: user.hide_from_leaderboard ? 'Visible on public leaderboard again' : 'Hidden from public leaderboard' },
    )
    if (ok) await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/40 text-xs leading-relaxed max-w-md">
          Same ranking as the public Leaderboard page. Hiding a user here only removes them
          from the public leaderboard display — their XP, rank, and account are unaffected.
        </p>
        <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="input w-auto text-sm shrink-0">
          {TOP_N_OPTIONS.map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
      </div>

      {users === null ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No users yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u, i) => (
            <div key={u.id} className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 ${u.hide_from_leaderboard ? 'opacity-50' : ''}`}>
              <span className="w-6 text-center text-white/40 text-xs font-mono">{i + 1}</span>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-[10px] font-bold">
                {u.avatar_url ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (u.username || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {u.full_name || u.username}
                  {u.hide_from_leaderboard && <span className="ml-2 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/20 text-white/50">hidden</span>}
                </div>
                <div className="text-white/40 text-xs">{u.country || '—'} · {getRank(u.xp).name}</div>
              </div>
              <div className="font-mono text-sm text-purple-light shrink-0">{u.xp} XP</div>
              <button
                onClick={() => toggleHidden(u)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5 shrink-0"
              >
                {u.hide_from_leaderboard ? 'Unhide' : 'Hide'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
