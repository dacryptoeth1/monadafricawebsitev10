import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import { freshnessLabel, PULSE_CATEGORY_LABELS } from '../../lib/ecosystemActivity'
import type { EcosystemActivity, EcosystemActivityFreshness, EcosystemActivityRegion, EcosystemActivityStatus, EcosystemPulseCategory, EcosystemSource } from '../../types'

const EMPTY_FORM: Record<string, string> = {
  title: '', description: '', category: '', status: 'recent', region: 'global', pulse_category: '',
  location: '', country: '', city: '', latitude: '', longitude: '',
  source_id: '', source_url: '', source_name: '', image_url: '',
  statistic_value: '', statistic_label: '', data_freshness: 'curated',
  is_published: 'true',
}

// The Admin -> Ecosystem Activity tab — lets an admin publish real,
// sourced entries for the /events "ecosystem intelligence" feed
// (migration 0043). The single 'live' TVL row is managed by the
// scheduled sync job (api/sync-ecosystem-tvl.ts) and editable here too
// (in case it ever needs a manual correction), but every other row is
// meant to be hand-curated — every entry should carry a real source_url.
export default function AdminEcosystemActivity({ showToast }: { showToast: (msg: string) => void }) {
  const [items, setItems] = useState<EcosystemActivity[]>([])
  const [sources, setSources] = useState<EcosystemSource[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('ecosystem_activity').select('*').order('published_at', { ascending: false })
    if (error) { console.error('Failed to load ecosystem_activity:', error); showToast(error.message) }
    setLoadError(error?.message ?? null)
    setItems((data as EcosystemActivity[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // The registered source dropdown below — migration 0044/0045.
    // Free-text source_url/source_name stay available for anything not
    // (yet) registered here, so this list is a convenience, not a gate.
    supabase.from('ecosystem_sources').select('*').eq('is_active', true).order('name').then(({ data }) => setSources((data as EcosystemSource[]) ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startCreate() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(item: EcosystemActivity) {
    setForm({
      title: item.title,
      description: item.description ?? '',
      category: item.category ?? '',
      status: item.status,
      region: item.region,
      pulse_category: item.pulse_category ?? '',
      location: item.location ?? '',
      country: item.country ?? '',
      city: item.city ?? '',
      latitude: item.latitude !== null ? String(item.latitude) : '',
      longitude: item.longitude !== null ? String(item.longitude) : '',
      source_id: item.source_id ?? '',
      source_url: item.source_url ?? '',
      source_name: item.source_name ?? '',
      image_url: item.image_url ?? '',
      statistic_value: item.statistic_value ?? '',
      statistic_label: item.statistic_label ?? '',
      data_freshness: item.data_freshness,
      is_published: String(item.is_published),
    })
    setEditingId(item.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title.trim()) { showToast('Title is required'); return }
    const lat = form.latitude.trim() ? Number(form.latitude) : null
    const lng = form.longitude.trim() ? Number(form.longitude) : null
    if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) {
      showToast('Latitude/longitude must be numbers, or left blank')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      status: form.status as EcosystemActivityStatus,
      region: form.region as EcosystemActivityRegion,
      pulse_category: (form.pulse_category.trim() || null) as EcosystemPulseCategory | null,
      location: form.location.trim() || null,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      latitude: lat,
      longitude: lng,
      source_id: form.source_id.trim() || null,
      source_url: form.source_url.trim() || null,
      source_name: form.source_name.trim() || null,
      image_url: form.image_url.trim() || null,
      statistic_value: form.statistic_value.trim() || null,
      statistic_label: form.statistic_label.trim() || null,
      data_freshness: form.data_freshness as EcosystemActivityFreshness,
      is_published: form.is_published === 'true',
    }

    const ok = editingId
      ? await runAdminAction(() => supabase.from('ecosystem_activity').update(payload).eq('id', editingId), showToast, { successMessage: 'Activity updated' })
      : await runAdminAction(() => supabase.from('ecosystem_activity').insert(payload), showToast, { successMessage: 'Activity published' })

    setSaving(false)
    if (!ok) return
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
    await load()
  }

  async function togglePublished(item: EcosystemActivity) {
    const ok = await runAdminAction(
      () => supabase.from('ecosystem_activity').update({ is_published: !item.is_published }).eq('id', item.id),
      showToast,
      { successMessage: item.is_published ? 'Unpublished' : 'Published' },
    )
    if (ok) await load()
  }

  async function handleDelete(item: EcosystemActivity) {
    const ok = await runAdminAction(
      () => supabase.from('ecosystem_activity').delete().eq('id', item.id),
      showToast,
      { confirmMessage: `Delete "${item.title}" permanently? This cannot be undone.`, successMessage: 'Deleted' },
    )
    if (ok) {
      if (editingId === item.id) { setShowForm(false); setEditingId(null) }
      await load()
    }
  }

  return (
    <div>
      <p className="text-white/40 text-xs mb-4 max-w-2xl">
        Powers the "Ecosystem intelligence" feed on /events. Every entry should be real — either
        automatically synced (the TVL stat, refreshed on a schedule) or hand-curated with a real
        source link. Nothing here should be invented.
      </p>

      <div className="flex justify-end mb-4">
        <button onClick={startCreate} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple">
          + New Activity
        </button>
      </div>

      {showForm && <ActivityForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} editing={!!editingId} sources={sources} />}

      {loading ? (
        <div className="text-white/40 text-sm py-10 text-center">Loading…</div>
      ) : loadError ? (
        <div className="text-rose-300 text-sm py-10 text-center">Couldn't load ecosystem activity: {loadError}</div>
      ) : items.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">Nothing here yet — add the first entry above.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm flex items-center gap-2 flex-wrap">
                  {item.title}
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/15 text-white/50">{item.status}</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/15 text-white/50">{item.region}</span>
                  {item.pulse_category && <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-purple/30 text-purple-light">{PULSE_CATEGORY_LABELS[item.pulse_category]}</span>}
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${item.is_published ? 'text-emerald-300 border-emerald-300/30' : 'text-white/40 border-white/20'}`}>
                    {item.is_published ? 'published' : 'unpublished'}
                  </span>
                </div>
                <div className="text-white/40 text-xs mt-1">{item.category || 'Uncategorized'} · {freshnessLabel(item)}{item.source_name ? ` · Source: ${item.source_name}` : ''}</div>
              </div>
              <div className="flex gap-2 flex-none flex-wrap">
                <button onClick={() => startEdit(item)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">Edit</button>
                <button onClick={() => togglePublished(item)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
                  {item.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => handleDelete(item)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white/40 hover:bg-white/5">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityForm({
  form, setForm, onSave, onCancel, saving, editing, sources,
}: {
  form: Record<string, string>
  setForm: (f: Record<string, string>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  editing: boolean
  sources: EcosystemSource[]
}) {
  function set(name: string, value: string) {
    setForm({ ...form, [name]: value })
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-6">
      <div className="text-xs text-purple-light font-semibold mb-3">{editing ? 'Editing activity' : 'New activity'}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LabeledInput label="Title *" value={form.title} onChange={(v) => set('title', v)} />
        <LabeledInput label="Category" value={form.category} onChange={(v) => set('category', v)} placeholder="Hackathon / Meetup / Ecosystem Update / Milestone…" />
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input w-full text-sm">
            <option value="live" className="bg-panel">Live</option>
            <option value="upcoming" className="bg-panel">Upcoming</option>
            <option value="recent" className="bg-panel">Recent</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Region</label>
          <select value={form.region} onChange={(e) => set('region', e.target.value)} className="input w-full text-sm">
            <option value="global" className="bg-panel">Global (wider Monad ecosystem)</option>
            <option value="africa" className="bg-panel">Africa</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Pulse category</label>
          <select value={form.pulse_category} onChange={(e) => set('pulse_category', e.target.value)} className="input w-full text-sm">
            <option value="" className="bg-panel">— None —</option>
            {Object.entries(PULSE_CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key} className="bg-panel">{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Registered source</label>
          <select value={form.source_id} onChange={(e) => set('source_id', e.target.value)} className="input w-full text-sm">
            <option value="" className="bg-panel">— Not registered (use free-text source below) —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id} className="bg-panel">{s.name}{s.handle ? ` (${s.handle})` : ''}</option>
            ))}
          </select>
        </div>
        <LabeledInput label="Location (display text)" value={form.location} onChange={(v) => set('location', v)} placeholder="e.g. Lagos, Nigeria" />
        <LabeledInput label="Country" value={form.country} onChange={(v) => set('country', v)} />
        <LabeledInput label="City" value={form.city} onChange={(v) => set('city', v)} />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Latitude" type="number" value={form.latitude} onChange={(v) => set('latitude', v)} />
          <LabeledInput label="Longitude" type="number" value={form.longitude} onChange={(v) => set('longitude', v)} />
        </div>
        <LabeledInput label="Source URL" type="url" value={form.source_url} onChange={(v) => set('source_url', v)} placeholder="Required for anything not self-evident" />
        <LabeledInput label="Source name" value={form.source_name} onChange={(v) => set('source_name', v)} placeholder="e.g. Monad Blog, X, Luma" />
        <LabeledInput label="Statistic value" value={form.statistic_value} onChange={(v) => set('statistic_value', v)} placeholder="Only if a real number/source backs it" />
        <LabeledInput label="Statistic label" value={form.statistic_label} onChange={(v) => set('statistic_label', v)} />
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Freshness</label>
          <select value={form.data_freshness} onChange={(e) => set('data_freshness', e.target.value)} className="input w-full text-sm">
            <option value="curated" className="bg-panel">Curated (hand-entered by an admin)</option>
            <option value="periodic" className="bg-panel">Periodic (refreshed on a schedule)</option>
            <option value="live" className="bg-panel">Live (kept in sync automatically)</option>
          </select>
        </div>
        <LabeledInput label="Image URL" value={form.image_url} onChange={(v) => set('image_url', v)} />
        <div className="sm:col-span-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} className="input w-full text-sm resize-y" />
        </div>
        <label className="sm:col-span-2 flex items-center gap-2.5 text-xs text-white/60 cursor-pointer">
          <input type="checkbox" checked={form.is_published === 'true'} onChange={(e) => set('is_published', String(e.target.checked))} />
          <span className="text-white/80 font-medium">Published (visible on the public site)</span>
        </label>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Publish Activity'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">Cancel</button>
      </div>
    </div>
  )
}

function LabeledInput({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input w-full text-sm" />
    </div>
  )
}
