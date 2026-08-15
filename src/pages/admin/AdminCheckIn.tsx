import { type FormEvent, useState } from 'react'
import { CheckCircle2, QrCode, ShieldAlert, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface LookupResult {
  registration_id: string
  full_name: string
  email: string
  event_id: string
  event_title: string
  event_date: string
  event_location: string | null
  checked_in: boolean
  checked_in_at: string | null
}

type Screen = { kind: 'idle' } | { kind: 'invalid' } | { kind: 'found'; row: LookupResult }

export default function AdminCheckIn({ showToast }: { showToast: (msg: string) => void }) {
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [screen, setScreen] = useState<Screen>({ kind: 'idle' })

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setSearching(true)
    const { data, error } = await supabase.rpc('admin_lookup_invite_code', { p_code: code.trim() })
    setSearching(false)
    if (error) { showToast(error.message); return }
    const row = Array.isArray(data) ? data[0] : data
    setScreen(row ? { kind: 'found', row } : { kind: 'invalid' })
  }

  async function handleCheckIn() {
    if (screen.kind !== 'found') return
    setCheckingIn(true)
    const { data, error } = await supabase.rpc('admin_check_in_registration', { p_code: code.trim() })
    setCheckingIn(false)
    if (error) { showToast(error.message); return }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) { showToast('Something went wrong.'); return }
    setScreen({
      kind: 'found',
      row: {
        ...screen.row,
        checked_in: true,
        checked_in_at: row.checked_in_at,
      },
    })
    showToast(row.already_checked_in ? 'Already checked in' : 'Checked in ✓')
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2"><QrCode size={18} /> Invite Verification / Check-In</h3>
        <p className="text-white/40 text-xs mt-1">Enter an attendee's invite code to verify their registration and check them in.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setScreen({ kind: 'idle' }) }}
          placeholder="MONAF-XXXX-XXXX"
          className="input flex-1 font-mono tracking-wider uppercase"
          autoFocus
        />
        <button type="submit" disabled={searching || !code.trim()} className="px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {screen.kind === 'invalid' && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6 text-center">
          <ShieldAlert size={28} className="text-rose-300 mx-auto mb-3" />
          <div className="font-display font-semibold text-rose-300 tracking-wide">INVALID INVITE CODE</div>
          <p className="text-rose-200/60 text-xs mt-1">No registration matches this code.</p>
        </div>
      )}

      {screen.kind === 'found' && (
        <div className={`rounded-2xl border p-6 ${screen.row.checked_in ? 'border-amber-400/30 bg-amber-400/10' : 'border-emerald-400/30 bg-emerald-400/10'}`}>
          <div className="flex items-center gap-2 mb-4">
            {screen.row.checked_in ? <ShieldCheck size={20} className="text-amber-300" /> : <CheckCircle2 size={20} className="text-emerald-300" />}
            <div className={`font-display font-semibold tracking-wide ${screen.row.checked_in ? 'text-amber-300' : 'text-emerald-300'}`}>
              {screen.row.checked_in ? 'ALREADY CHECKED IN' : 'VALID REGISTRATION'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-5">
            <Field label="Name" value={screen.row.full_name} />
            <Field label="Email" value={screen.row.email} />
            <Field label="Event" value={screen.row.event_title} />
            <Field label="Registration status" value="Registered" />
            <Field
              label="Check-in status"
              value={screen.row.checked_in ? `Checked in at ${new Date(screen.row.checked_in_at!).toLocaleString()}` : 'Not checked in'}
            />
          </div>

          {!screen.row.checked_in && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50"
            >
              {checkingIn ? 'Checking in…' : 'Check In'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-white/40">{label}</div>
      <div className="text-white/80 truncate">{value}</div>
    </div>
  )
}
