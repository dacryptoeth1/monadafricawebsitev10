<<<<<<< HEAD
import { type FormEvent, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'
import Reveal from '../components/Reveal'

const ROLES: UserRole[] = ['Developer', 'Designer', 'Content Creator', 'Community Member', 'Founder', 'Student']
=======
import { type FormEvent, useEffect, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { Country } from 'country-state-city'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Badge, UserBadge } from '../types'
import { USER_ROLES, normalizeUserRole } from '../lib/userRole'
import Reveal from '../components/Reveal'
import CountrySelect from '../components/CountrySelect'
import RegionSelect from '../components/RegionSelect'
import ProfileStatsHeader from '../components/ProfileStatsHeader'
import { getErrorMessage, logError } from '../lib/errors'

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/

function findIsoByName(name: string | null): string {
  if (!name) return ''
  const match = Country.getAllCountries().find((c) => c.name === name)
  return match?.isoCode ?? ''
}
>>>>>>> fix/password-reset-otp-admin-api

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null)
<<<<<<< HEAD
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
=======
  const [countryIso, setCountryIso] = useState(() => findIsoByName(profile?.country ?? null))
  const [countryName, setCountryName] = useState(profile?.country ?? '')
  const [region, setRegion] = useState(profile?.region ?? '')
  const [walletAddress, setWalletAddress] = useState(profile?.wallet_address ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [badges, setBadges] = useState<(Badge & { awarded_at: string })[]>([])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('user_badges')
      .select('awarded_at, badges(*)')
      .eq('user_id', profile.id)
      .then(({ data }) => {
        const rows = ((data as any[]) ?? []).map((r) => ({ ...(r.badges as Badge), awarded_at: r.awarded_at as string }))
        setBadges(rows)
      })
  }, [profile?.id])
>>>>>>> fix/password-reset-otp-admin-api

  if (!profile) return null

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setAvatarFile(f)
    if (f) setAvatarPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const data = new FormData(e.currentTarget)
<<<<<<< HEAD
=======

    const wallet = walletAddress.trim()
    if (wallet && !wallet.startsWith('0x')) {
      setError('Wallet address must start with 0x.')
      return
    }
    if (wallet && !WALLET_RE.test(wallet)) {
      setError('That doesn\u2019t look like a valid EVM wallet address (expected 0x followed by 40 hex characters).')
      return
    }

    const username = String(data.get('username') || '').trim()
    if (!username) {
      setError('Username is required.')
      return
    }

    // profiles.role has a CHECK constraint (profiles_role_check) that
    // only accepts the exact USER_ROLES strings, or NULL — never an
    // empty string or a differently-cased value. The <select> below is
    // built from USER_ROLES so this should always normalize cleanly;
    // if it somehow doesn't (a stale bundle, a legacy value, dev
    // tooling tampering with the form), roleUpdate stays an empty
    // object below and the field is left out of the update entirely —
    // the existing saved role is preserved rather than risking a
    // constraint violation or overwriting it with something invalid.
    const normalizedRole = normalizeUserRole(String(data.get('role') || ''))

>>>>>>> fix/password-reset-otp-admin-api
    setSaving(true)
    try {
      let avatarUrl = profile!.avatar_url
      if (avatarFile) {
        const path = `${profile!.id}/${Date.now()}-${avatarFile.name}`
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = pub.publicUrl
      }

<<<<<<< HEAD
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          full_name: String(data.get('full_name') || ''),
          username: String(data.get('username') || ''),
          country: String(data.get('country') || ''),
          role: String(data.get('role') || ''),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile!.id)
      if (updateErr) throw updateErr
=======
      const roleUpdate = normalizedRole ? { role: normalizedRole } : {}

      const profileUpdatePayload = {
        full_name: String(data.get('full_name') || ''),
        username,
        country: countryName,
        region,
        ...roleUpdate,
        bio: String(data.get('bio') || ''),
        twitter: String(data.get('twitter') || ''),
        telegram: String(data.get('telegram') || ''),
        discord: String(data.get('discord') || ''),
        website: String(data.get('website') || ''),
        github: String(data.get('github') || ''),
        wallet_address: wallet,
        wallet_provider: null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }

      // Diagnostic trace for profiles_role_check failures — logs the
      // exact role value about to be sent (or confirms it's being
      // omitted, preserving whatever role is already saved) right
      // before the request goes out. Check the browser console when
      // reproducing a role-related save error.
      console.log('[Profile save] role field from form:', JSON.stringify(String(data.get('role') || '')), '→ normalized:', normalizedRole, '→ sending to Supabase:', 'role' in profileUpdatePayload ? JSON.stringify(profileUpdatePayload.role) : '(omitted — existing role preserved)')

      const { error: updateErr } = await supabase
        .from('profiles')
        .update(profileUpdatePayload)
        .eq('id', profile!.id)

      if (updateErr) {
        // Postgres unique_violation — friendlier than the raw DB error.
        if ((updateErr as any).code === '23505') {
          throw new Error('That username is already taken — try another.')
        }
        // PGRST204: PostgREST doesn't recognize a column that (per the
        // migrations) should exist. This is a server-side schema-cache
        // issue, not something a retry from here can fix — surface it
        // as actionable instead of the raw opaque message.
        if ((updateErr as any).code === 'PGRST204') {
          throw new Error(
            "The database hasn't picked up a recent schema change yet. In Supabase: Settings → API → \"Reload schema cache\" (or run NOTIFY pgrst, 'reload schema'; in the SQL Editor), then try saving again."
          )
        }
        throw updateErr
      }

      // Best-effort: award the one-time profile-completion XP bonus if
      // this save just completed the profile. Silently ignored if not
      // eligible yet or already claimed — the RPC checks server-side.
      try {
        await supabase.rpc('claim_profile_completion_bonus')
      } catch {
        // non-fatal
      }
      // Same pattern for the wallet-connect bonus — server re-verifies
      // a real address is saved before paying out, and only ever once.
      try {
        await supabase.rpc('claim_wallet_connect_bonus')
      } catch {
        // non-fatal
      }
>>>>>>> fix/password-reset-otp-admin-api

      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
<<<<<<< HEAD
    } catch {
      setError('Something went wrong saving your profile.')
=======
    } catch (err) {
      logError('[Profile] save failed:', err)
      setError(getErrorMessage(err, 'Something went wrong saving your profile.'))
>>>>>>> fix/password-reset-otp-admin-api
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
<<<<<<< HEAD
      <div className="max-w-lg mx-auto px-6">
        <Reveal>
          <h1 className="font-display font-semibold text-3xl mb-8 text-center">Edit Profile</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
=======
      <div className="max-w-2xl mx-auto px-6">
        <Reveal className="mb-10">
          <ProfileStatsHeader profile={profile} badges={badges} />
        </Reveal>

        <Reveal>
          <h1 className="font-display font-semibold text-2xl mb-6 text-center">Edit Profile</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg mx-auto">
>>>>>>> fix/password-reset-otp-admin-api
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden text-2xl font-display font-bold">
                {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" /> : (profile.username || '?').slice(0, 2).toUpperCase()}
              </div>
              <label className="text-xs font-semibold text-purple-light cursor-pointer flex items-center gap-1.5">
                <UploadCloud size={14} /> Change photo
                <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              </label>
            </div>

            <Field label="Full Name" name="full_name" defaultValue={profile.full_name ?? ''} />
            <Field label="Username" name="username" defaultValue={profile.username ?? ''} />
<<<<<<< HEAD
            <Field label="Country" name="country" defaultValue={profile.country ?? ''} />
=======

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Country</label>
              <CountrySelect
                value={countryIso}
                onChange={(iso, name) => {
                  setCountryIso(iso)
                  setCountryName(name)
                  setRegion('') // reset region when country changes
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Region / State</label>
              <RegionSelect countryIsoCode={countryIso} value={region} onChange={setRegion} />
            </div>
>>>>>>> fix/password-reset-otp-admin-api

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Role</label>
              <select name="role" defaultValue={profile.role ?? 'Developer'} className="input">
<<<<<<< HEAD
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

=======
                {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Bio</label>
              <textarea name="bio" rows={3} defaultValue={profile.bio ?? ''} placeholder="A short line about you" className="input resize-y" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="X / Twitter" name="twitter" defaultValue={profile.twitter ?? ''} placeholder="@handle" />
              <Field label="Telegram" name="telegram" defaultValue={profile.telegram ?? ''} placeholder="@handle" />
              <Field label="Discord" name="discord" defaultValue={profile.discord ?? ''} placeholder="username" />
              <Field label="Website" name="website" defaultValue={profile.website ?? ''} placeholder="https://" />
              <Field label="GitHub" name="github" defaultValue={profile.github ?? ''} placeholder="username" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Wallet Address (EVM)</label>
              <input
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x…"
                spellCheck={false}
                className="input font-mono"
              />
            </div>
            <p className="text-white/30 text-[11px] -mt-2">
              Paste your EVM wallet address manually (must start with 0x) — used for reward distribution.
            </p>

>>>>>>> fix/password-reset-otp-admin-api
            {error && <div className="text-sm text-rose-300">{error}</div>}
            {saved && <div className="text-sm text-emerald-300">Profile saved.</div>}

            <button type="submit" disabled={saving} className="mt-2 px-5 py-3.5 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  )
}

<<<<<<< HEAD
function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input name={name} defaultValue={defaultValue} className="input" />
=======
function Field({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue: string; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="input" />
>>>>>>> fix/password-reset-otp-admin-api
    </div>
  )
}
