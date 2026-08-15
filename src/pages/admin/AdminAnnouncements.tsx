import { useEffect, useState } from 'react'
import { Pin, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Announcement } from '../../types'

export default function AdminAnnouncements({ showToast }: { showToast: (msg: string) => void }) {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [sending, setSending] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
    if (error) { console.error('Failed to load announcements:', error); showToast(error.message) }
    setLoadError(error?.message ?? null)
    setItems((data as Announcement[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!title.trim()) return
    const { error } = await supabase.from('announcements').insert({ title, body })
    if (error) { showToast(error.message); return }
    setTitle('')
    setBody('')
    await load()
    showToast('Announcement posted')
  }

  async function togglePin(a: Announcement) {
    const { error } = await supabase.from('announcements').update({ pinned: !a.pinned }).eq('id', a.id)
    if (error) { showToast(error.message); return }
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this announcement permanently?')) return
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) { showToast(error.message); return }
    await load()
    showToast('Deleted')
  }

  async function sendBroadcast() {
    if (!notifTitle.trim()) return
    if (!confirm('Send this notification to every user on the platform? This cannot be recalled once sent.')) return
    setSending(true)
    const { error } = await supabase.from('notifications').insert({
      user_id: null, // NULL = broadcast, appears for every user's notification bell
      type: 'announcement',
      title: notifTitle,
      message: notifMessage || null,
    })
    setSending(false)
    if (error) { showToast(error.message); return }
    setNotifTitle('')
    setNotifMessage('')
    showToast('Notification sent to all users')
  }

  if (loading) return <div className="text-white/40 text-sm">Loading…</div>

  return (
    <div>
      <h4 className="text-xs font-mono uppercase text-white/40 mb-3">Pinned Announcement Banner</h4>
      <p className="text-white/30 text-xs mb-3 leading-relaxed">
        Shows as a dismissible strip across the top of every page while pinned.
      </p>
      <div className="grid grid-cols-1 gap-3 p-4 border border-white/10 rounded-2xl bg-white/[0.02] mb-8">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="input w-full text-sm" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body (optional)" rows={2} className="input w-full text-sm" />
        <div>
          <button onClick={handleCreate} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple">Post Announcement</button>
        </div>
      </div>

      <h4 className="text-xs font-mono uppercase text-white/40 mb-3 flex items-center gap-1.5"><Send size={12} /> Send Notification to All Users</h4>
      <p className="text-white/30 text-xs mb-3 leading-relaxed">
        Delivered straight to every user's notification bell (not shown as a page banner).
      </p>
      <div className="grid grid-cols-1 gap-3 p-4 border border-white/10 rounded-2xl bg-white/[0.02] mb-8">
        <input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="Notification title" className="input w-full text-sm" />
        <textarea value={notifMessage} onChange={(e) => setNotifMessage(e.target.value)} placeholder="Message (optional)" rows={2} className="input w-full text-sm" />
        <div>
          <button onClick={sendBroadcast} disabled={sending || !notifTitle.trim()} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-40">
            {sending ? 'Sending…' : 'Send to Everyone'}
          </button>
        </div>
      </div>

      <h4 className="text-xs font-mono uppercase text-white/40 mb-3">Announcement History</h4>
      {loadError ? (
        <div className="text-rose-300 text-sm py-6 text-center">Couldn't load announcements: {loadError}</div>
      ) : items.length === 0 ? (
        <div className="text-white/40 text-sm py-6 text-center">No announcements yet.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-sm flex items-center gap-2">
                  {a.pinned && <Pin size={12} className="text-gold" />}
                  {a.title}
                </div>
                {a.body && <div className="text-white/40 text-xs mt-1">{a.body}</div>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => togglePin(a)} className="text-xs text-purple-light hover:text-white">{a.pinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={() => remove(a.id)} className="text-xs text-white/40 hover:text-rose-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
