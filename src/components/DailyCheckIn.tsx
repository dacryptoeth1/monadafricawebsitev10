import { useState } from 'react'
import { Check, Flame, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

// Calendar-date check, not a 24-hour timer: "today" is always the
// current UTC calendar date, matching daily_checkin()'s own
// `(now() at time zone 'utc')::date` — so a button that reads
// "available" here is never rejected by the server, and vice versa.
// (toISOString() always renders in UTC regardless of the visitor's
// local timezone, so this needs no timezone handling of its own.)
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

interface CheckinResult {
  success: boolean
  already_checked_in: boolean
  xp: number
  checkin_streak: number
  checkin_date: string
}

// The Daily Check-in card — one +1 XP action per calendar day, wired to
// daily_checkin() (migration 0050). The button's enabled/disabled state
// is derived from the real profile row (last_checkin_date), not local
// component state alone, so a page refresh always shows the true
// server-verified status; the RPC re-verifies the date server-side
// regardless of what the button shows, so nothing here is the actual
// anti-farming guarantee — that's entirely in daily_checkin() itself.
export default function DailyCheckIn({ profile, onCheckedIn }: { profile: Profile; onCheckedIn: () => void }) {
  const [checkingIn, setCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set only right after a successful, brand-new check-in this session
  // — drives the one-time "+1 XP earned" confirmation copy. A refresh
  // (or having already checked in earlier today) shows the plain
  // "already checked in" state instead, never a fake confirmation.
  const [justEarned, setJustEarned] = useState(false)

  const checkedInToday = profile.last_checkin_date === todayUtc()

  async function handleCheckIn() {
    if (checkingIn || checkedInToday) return
    setCheckingIn(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('daily_checkin')
    setCheckingIn(false)
    if (rpcError) {
      console.error('[DailyCheckIn] daily_checkin failed:', rpcError)
      setError("Couldn't check in right now — please try again.")
      return
    }
    const row = (Array.isArray(data) ? data[0] : data) as CheckinResult | undefined
    if (row?.success) setJustEarned(true)
    onCheckedIn()
  }

  return (
    <div className="rounded-squircle border border-white/10 bg-panel/40 p-6 flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            checkedInToday ? 'bg-emerald-400/15 text-emerald-300' : 'bg-purple/15 text-purple-light'
          }`}
        >
          {checkedInToday ? <Check size={20} /> : <Sparkles size={20} />}
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-base">Daily Check-in</h3>
          <p className="text-white/45 text-xs mt-0.5">
            {checkedInToday
              ? justEarned
                ? 'Daily check-in complete — +1 XP earned.'
                : "You've already checked in today — come back tomorrow."
              : 'Check in today to earn +1 XP.'}
          </p>
          {error && <p className="text-rose-300 text-xs mt-1">{error}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {profile.checkin_streak > 1 && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-gold">
            <Flame size={13} /> {profile.checkin_streak} day streak
          </span>
        )}
        <span className="text-xs font-mono px-3 py-1.5 rounded-full border border-purple/30 bg-purple/10 text-purple-light">
          {profile.xp} XP
        </span>
        <button
          onClick={handleCheckIn}
          disabled={checkedInToday || checkingIn}
          className={`px-5 py-3 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
            checkedInToday
              ? 'border border-emerald-300/30 bg-emerald-400/10 text-emerald-300 cursor-default'
              : 'bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 disabled:opacity-50'
          }`}
        >
          {checkedInToday ? '✓ Checked in today' : checkingIn ? 'Checking in…' : 'Check in today'}
        </button>
      </div>
    </div>
  )
}
