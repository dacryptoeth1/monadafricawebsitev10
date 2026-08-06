import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

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
  onAdded,
}: {
  table: string
  fields: FieldDef[]
  titleField: string
  subtitleField?: string
  onAdded?: () => void
}) {
  const [items, setItems] = useState<Record<string, any>[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [table])

  async function handleAdd() {
    if (!form[titleField]?.trim()) return
    await supabase.from(table).insert(form)
    setForm({})
    await load()
    onAdded?.()
  }

  async function handleDelete(id: string) {
    await supabase.from(table).delete().eq('id', id)
    await load()
  }

  return (
    <div>
      <div className="mini-grid grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border border-white/10 rounded-2xl bg-white/[0.02] mb-6">
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
        <div className="sm:col-span-2">
          <button onClick={handleAdd} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple">
            Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-white/40 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-white/40 text-sm py-6 text-center">Nothing here yet.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{item[titleField]}</div>
                {subtitleField && item[subtitleField] && <div className="text-white/40 text-xs truncate">{item[subtitleField]}</div>}
              </div>
              <button onClick={() => handleDelete(item.id)} className="text-xs text-white/40 hover:text-rose-300 shrink-0">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
