import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { XpRewardConfig } from '../../types'

export default function AdminXpConfig({ showToast }: { showToast: (msg: string) => void }) {
  const [rewards, setRewards] = useState<XpRewardConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('xp_reward_config').select('*').order('key')
    if (error) { console.error('Failed to load XP reward config:', error); showToast(error.message) }
    setLoadError(error?.message ?? null)
    setRewards((data as XpRewardConfig[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(key: string, amount: number) {
    setSaving(key)
    // Optimistic update — the row reflects the new amount immediately
    // instead of waiting on a second round-trip reload; reverted below
    // if the write actually fails.
    const previous = rewards
    const updatedAt = new Date().toISOString()
    setRewards((rs) => rs.map((r) => (r.key === key ? { ...r, amount, updated_at: updatedAt } : r)))

    const { error } = await supabase.from('xp_reward_config').update({ amount, updated_at: updatedAt }).eq('key', key)
    setSaving(null)
    if (error) {
      setRewards(previous)
      showToast(error.message)
      return
    }
    showToast('XP reward updated')
  }

  if (loading) return <div className="text-white/40 text-sm">Loading…</div>

  return (
    <div className="max-w-2xl">
      <p className="text-white/40 text-xs mb-6 leading-relaxed">
        These amounts drive every automatic XP award across the platform — change them here,
        no code changes needed. "Community Campaign" is the default amount used when awarding
        XP manually from the Users tab; you can still override it per-award there.
      </p>
      {loadError ? (
        <div className="text-rose-300 text-sm py-6 text-center">Couldn't load XP reward config: {loadError}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {rewards.map((r) => (
            <RewardRow key={r.key} reward={r} saving={saving === r.key} onSave={(amt) => save(r.key, amt)} />
          ))}
        </div>
      )}
    </div>
  )
}

function RewardRow({ reward, saving, onSave }: { reward: XpRewardConfig; saving: boolean; onSave: (amount: number) => void }) {
  const [value, setValue] = useState(reward.amount)
  const dirty = value !== reward.amount

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{reward.label}</div>
        <div className="text-white/30 text-[11px] font-mono">{reward.key}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="input w-24 text-sm text-right"
        />
        <span className="text-white/40 text-xs">XP</span>
        <button
          onClick={() => onSave(value)}
          disabled={!dirty || saving}
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-30"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
