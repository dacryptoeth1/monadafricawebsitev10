import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
<<<<<<< HEAD
=======
import { runAdminAction } from '../../lib/adminActions'
>>>>>>> fix/password-reset-otp-admin-api

export interface FieldDef {
  name: string
  label: string
  type?: 'text' | 'url' | 'email' | 'textarea'
  placeholder?: string
}

export default function AdminCollectionPanel({
  table,
  fields,
  titleField,
  subtitleField,
<<<<<<< HEAD
=======
  showToast,
>>>>>>> fix/password-reset-otp-admin-api
  onAdded,
}: {
  table: string
  fields: FieldDef[]
  titleField: string
  subtitleField?: string
<<<<<<< HEAD
=======
  showToast: (msg: string) => void
>>>>>>> fix/password-reset-otp-admin-api
  onAdded?: () => void
}) {
  const [items, setItems] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
<<<<<<< HEAD
  const [form, setForm] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false })
=======
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    if (error) {
      console.error(`Failed to load ${table}:`, error)
      showToast(error.message)
    }
    setLoadError(error?.message ?? null)
>>>>>>> fix/password-reset-otp-admin-api
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
<<<<<<< HEAD
  }, [table])

  async function handleAdd() {
    if (!form[titleField]?.trim()) return
    await supabase.from(table).insert(form)
=======
    setEditingId(null)
    setForm({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  function startEdit(item: Record<string, any>) {
    const next: Record<string, string> = {}
    fields.forEach((f) => { next[f.name] = item[f.name] ?? '' })
    setForm(next)
    setEditingId(item.id)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({})
  }

  async function handleSubmit() {
    if (!form[titleField]?.trim()) return
    setSaving(true)

    if (editingId) {
      const ok = await runAdminAction(
        () => supabase.from(table).update(form).eq('id', editingId),
        showToast,
        { successMessage: 'Updated' },
      )
      setSaving(false)
      if (!ok) return // keep the form filled in so nothing typed is lost
      setForm({})
      setEditingId(null)
      await load()
      return
    }

    const ok = await runAdminAction(
      () => supabase.from(table).insert(form),
      showToast,
      { successMessage: 'Added' },
    )
    setSaving(false)
    if (!ok) return // preserve what the admin typed instead of silently clearing it
>>>>>>> fix/password-reset-otp-admin-api
    setForm({})
    await load()
    onAdded?.()
  }

  async function handleDelete(id: string) {
<<<<<<< HEAD
    await supabase.from(table).delete().eq('id', id)
    await load()
=======
    const ok = await runAdminAction(
      () => supabase.from(table).delete().eq('id', id),
      showToast,
      { confirmMessage: 'Delete this item permanently? This cannot be undone.', successMessage: 'Deleted' },
    )
    if (ok) {
      if (editingId === id) cancelEdit()
      await load()
    }
>>>>>>> fix/password-reset-otp-admin-api
  }

  return (
    <div>
      <div className="mini-grid grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border border-white/10 rounded-2xl bg-white/[0.02] mb-6">
<<<<<<< HEAD
=======
        {editingId && (
          <div className="sm:col-span-2 text-xs text-purple-light font-semibold">Editing existing item — Save to apply changes, or Cancel.</div>
        )}
>>>>>>> fix/password-reset-otp-admin-api
        {fields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                className="input w-full text-sm"
                rows={2}
                placeholder={f.placeholder}
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              />
            ) : (
              <input
                className="input w-full text-sm"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              />
            )}
          </div>
        ))}
<<<<<<< HEAD
        <div className="sm:col-span-2">
          <button onClick={handleAdd} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple">
            Add
          </button>
=======
        <div className="sm:col-span-2 flex gap-2">
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add'}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
              Cancel
            </button>
          )}
>>>>>>> fix/password-reset-otp-admin-api
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
<<<<<<< HEAD
=======
      ) : loadError ? (
        <div className="text-rose-300 text-sm py-6 text-center">Couldn't load this list: {loadError}</div>
>>>>>>> fix/password-reset-otp-admin-api
      ) : items.length === 0 ? (
        <div className="text-white/40 text-sm py-6 text-center">Nothing here yet.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
<<<<<<< HEAD
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
=======
            <div key={item.id} className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${editingId === item.id ? 'border-purple/40 bg-purple/5' : 'border-white/10 bg-white/[0.02]'}`}>
>>>>>>> fix/password-reset-otp-admin-api
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{item[titleField]}</div>
                {subtitleField && item[subtitleField] && <div className="text-white/40 text-xs truncate">{item[subtitleField]}</div>}
              </div>
<<<<<<< HEAD
              <button onClick={() => handleDelete(item.id)} className="text-xs text-white/40 hover:text-rose-300 shrink-0">
                Delete
              </button>
=======
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => startEdit(item)} className="text-xs text-white/40 hover:text-purple-light">
                  Edit
                </button>
                <button onClick={() => handleDelete(item.id)} className="text-xs text-white/40 hover:text-rose-300">
                  Delete
                </button>
              </div>
>>>>>>> fix/password-reset-otp-admin-api
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
