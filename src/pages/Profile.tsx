import { type FormEvent, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'
import Reveal from '../components/Reveal'

const ROLES: UserRole[] = ['Developer', 'Designer', 'Content Creator', 'Community Member', 'Founder', 'Student']

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch {
      setError('Something went wrong saving your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-lg mx-auto px-6">
        <Reveal>
          <h1 className="font-display font-semibold text-3xl mb-8 text-center">Edit Profile</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            <Field label="Country" name="country" defaultValue={profile.country ?? ''} />

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Role</label>
              <select name="role" defaultValue={profile.role ?? 'Developer'} className="input">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

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

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input name={name} defaultValue={defaultValue} className="input" />
    </div>
  )
}
