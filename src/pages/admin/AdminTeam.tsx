import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, UploadCloud } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import { logError } from '../../lib/errors'
import type { TeamMember } from '../../types'
import { initialsFor } from '../../components/TeamMemberCard'

interface Draft {
  name: string
  primary_role: string
  badges: string // comma-separated in the form, split into text[] on save
  x_url: string
  telegram_url: string
  linkedin_url: string
  github_url: string
  discord_url: string
  website_url: string
  bio: string
  is_bd_lead: boolean
  is_active: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '',
  primary_role: '',
  badges: '',
  x_url: '',
  telegram_url: '',
  linkedin_url: '',
  github_url: '',
  discord_url: '',
  website_url: '',
  bio: '',
  is_bd_lead: false,
  is_active: true,
}

export default function AdminTeam({ showToast }: { showToast: (msg: string) => void }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('team_members').select('*').order('display_order', { ascending: true })
    if (error) { console.error('Failed to load team members:', error); showToast(error.message) }
    setLoadError(error?.message ?? null)
    setMembers((data as TeamMember[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startEdit(m: TeamMember) {
    setEditingId(m.id)
    setDraft({
      name: m.name,
      primary_role: m.primary_role,
      badges: m.badges.join(', '),
      x_url: m.x_url || '',
      telegram_url: m.telegram_url || '',
      linkedin_url: m.linkedin_url || '',
      github_url: m.github_url || '',
      discord_url: m.discord_url || '',
      website_url: m.website_url || '',
      bio: m.bio || '',
      is_bd_lead: m.is_bd_lead,
      is_active: m.is_active,
    })
    setExistingAvatarUrl(m.avatar_url)
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setAvatarFile(null)
    setAvatarPreview(null)
    setExistingAvatarUrl(null)
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setAvatarFile(file)
    setAvatarPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit() {
    if (!draft.name.trim() || !draft.primary_role.trim()) {
      showToast('Name and main role are required')
      return
    }
    setSaving(true)
    try {
      let avatar_url = existingAvatarUrl
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('team').upload(path, avatarFile)
        if (uploadErr) throw uploadErr
        const { data: pub } = supabase.storage.from('team').getPublicUrl(path)
        avatar_url = pub.publicUrl
      }

      const payload = {
        name: draft.name.trim(),
        primary_role: draft.primary_role.trim(),
        badges: draft.badges.split(',').map((b) => b.trim()).filter(Boolean),
        avatar_url,
        x_url: draft.x_url.trim() || null,
        telegram_url: draft.telegram_url.trim() || null,
        linkedin_url: draft.linkedin_url.trim() || null,
        github_url: draft.github_url.trim() || null,
        discord_url: draft.discord_url.trim() || null,
        website_url: draft.website_url.trim() || null,
        bio: draft.bio.trim() || null,
        is_bd_lead: draft.is_bd_lead,
        is_active: draft.is_active,
      }

      if (editingId) {
        const { error } = await supabase.from('team_members').update(payload).eq('id', editingId)
        if (error) throw error
        showToast('Team member updated')
      } else {
        const nextOrder = members.length > 0 ? Math.max(...members.map((m) => m.display_order)) + 1 : 1
        const { error } = await supabase.from('team_members').insert({ ...payload, display_order: nextOrder })
        if (error) throw error
        showToast('Team member added')
      }
      cancelEdit()
      await load()
    } catch (err) {
      logError('[AdminTeam] save failed:', err)
      showToast(err instanceof Error ? err.message : 'Something went wrong saving this team member')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(m: TeamMember) {
    const ok = await runAdminAction(
      () => supabase.from('team_members').delete().eq('id', m.id),
      showToast,
      { confirmMessage: `Delete ${m.name} from the official team? This cannot be undone.`, successMessage: 'Team member deleted' },
    )
    if (ok) {
      if (editingId === m.id) cancelEdit()
      await load()
    }
  }

  async function toggleActive(m: TeamMember) {
    const ok = await runAdminAction(
      () => supabase.from('team_members').update({ is_active: !m.is_active }).eq('id', m.id),
      showToast,
      { successMessage: m.is_active ? 'Member deactivated (hidden from /team)' : 'Member activated (visible on /team)' },
    )
    if (ok) await load()
  }

  async function move(m: TeamMember, direction: -1 | 1) {
    const sorted = [...members].sort((a, b) => a.display_order - b.display_order)
    const idx = sorted.findIndex((x) => x.id === m.id)
    const swapWith = sorted[idx + direction]
    if (!swapWith) return
    const ok = await runAdminAction(
      async () => {
        const a = await supabase.from('team_members').update({ display_order: swapWith.display_order }).eq('id', m.id)
        if (a.error) return a
        return supabase.from('team_members').update({ display_order: m.display_order }).eq('id', swapWith.id)
      },
      showToast,
    )
    if (ok) await load()
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border border-white/10 rounded-2xl bg-white/[0.02] mb-6">
        {editingId && <div className="sm:col-span-2 text-xs text-purple-light font-semibold">Editing existing member — Save to apply changes, or Cancel.</div>}

        <div className="sm:col-span-2 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-sm font-display font-bold">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : existingAvatarUrl ? (
              <img src={existingAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : draft.name ? (
              initialsFor(draft.name)
            ) : (
              '?'
            )}
          </div>
          <label className="input flex items-center gap-3 cursor-pointer text-sm">
            <UploadCloud size={15} className="text-white/40 shrink-0" />
            <span className="text-white/50 truncate">{avatarFile ? avatarFile.name : 'Upload profile photo (optional — falls back to initials)'}</span>
            <input type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
          </label>
        </div>

        <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Full name" />
        <Field label="Main Role (displayed title)" value={draft.primary_role} onChange={(v) => setDraft({ ...draft, primary_role: v })} placeholder="e.g. Co-founder & Lead Business Development" />
        <Field label="Additional Roles / Badges (comma-separated)" value={draft.badges} onChange={(v) => setDraft({ ...draft, badges: v })} placeholder="e.g. Partnerships, Community" className="sm:col-span-2" />
        <Field label="X / Twitter URL" value={draft.x_url} onChange={(v) => setDraft({ ...draft, x_url: v })} placeholder="https://x.com/username" />
        <Field label="Telegram URL" value={draft.telegram_url} onChange={(v) => setDraft({ ...draft, telegram_url: v })} placeholder="https://t.me/username" />
        <Field label="LinkedIn URL" value={draft.linkedin_url} onChange={(v) => setDraft({ ...draft, linkedin_url: v })} placeholder="https://linkedin.com/in/username" />
        <Field label="GitHub URL" value={draft.github_url} onChange={(v) => setDraft({ ...draft, github_url: v })} placeholder="https://github.com/username" />
        <Field label="Discord URL" value={draft.discord_url} onChange={(v) => setDraft({ ...draft, discord_url: v })} placeholder="https://discord.com/users/… or a server invite" />
        <Field label="Website URL" value={draft.website_url} onChange={(v) => setDraft({ ...draft, website_url: v })} placeholder="https://…" />

        <div className="sm:col-span-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Short Professional Description</label>
          <textarea className="input w-full text-sm" rows={2} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
        </div>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={draft.is_bd_lead} onChange={(e) => setDraft({ ...draft, is_bd_lead: e.target.checked })} className="accent-gold" />
          Primary Business Development contact
        </label>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="accent-purple" />
          Active (visible on /team)
        </label>

        <div className="sm:col-span-2 flex gap-2">
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Team Member'}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
              Cancel
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : loadError ? (
        <div className="text-rose-300 text-sm py-6 text-center">Couldn't load team members: {loadError}</div>
      ) : members.length === 0 ? (
        <div className="text-white/40 text-sm py-6 text-center">No team members yet — add the first one above.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {members.map((m, i) => (
            <div key={m.id} className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${editingId === m.id ? 'border-purple/40 bg-purple/5' : 'border-white/10 bg-white/[0.02]'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 text-xs font-display font-bold">
                  {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : initialsFor(m.name)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate flex items-center gap-1.5">
                    {m.name}
                    {m.is_bd_lead && <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border border-gold/40 text-gold">BD lead</span>}
                    {!m.is_active && <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full border border-white/15 text-white/40">inactive</span>}
                  </div>
                  <div className="text-white/40 text-xs truncate">{m.primary_role}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => move(m, -1)} disabled={i === 0} className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20" title="Move up">
                  <ArrowUp size={12} />
                </button>
                <button onClick={() => move(m, 1)} disabled={i === members.length - 1} className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20" title="Move down">
                  <ArrowDown size={12} />
                </button>
                <button onClick={() => toggleActive(m)} className="text-xs text-white/40 hover:text-purple-light px-2">
                  {m.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => startEdit(m)} className="text-xs text-white/40 hover:text-purple-light px-2">Edit</button>
                <button onClick={() => handleDelete(m)} className="text-xs text-white/40 hover:text-rose-300 px-2">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, className = '' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">{label}</label>
      <input className="input w-full text-sm" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
