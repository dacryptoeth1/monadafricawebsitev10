import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, Mail, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import { sendInviteEmail } from '../../lib/sendInviteEmail'
import { formatEventDate } from '../../lib/eventStatus'
import type { EventListing, EventListingStatus, EventRegistration } from '../../types'

const EMPTY_FORM: Record<string, string> = {
  title: '', description: '', event_date: '', start_time: '', end_time: '',
  location: '', image_url: '', event_url: '', capacity: '', registration_deadline: '', status: 'published',
}

export default function AdminEventRegistrations({ showToast }: { showToast: (msg: string) => void }) {
  const [events, setEvents] = useState<EventListing[]>([])
  const [registrations, setRegistrations] = useState<EventRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const [detail, setDetail] = useState<EventRegistration | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: ev, error: evErr }, { data: regs, error: regErr }] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('event_registrations').select('*').order('created_at', { ascending: false }),
    ])
    if (evErr) { console.error('Failed to load events:', evErr); showToast(evErr.message) }
    if (regErr) { console.error('Failed to load event registrations:', regErr); showToast(regErr.message) }
    setLoadError(evErr?.message || regErr?.message || null)
    setEvents((ev as EventListing[]) ?? [])
    setRegistrations((regs as EventRegistration[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => {
    const m = new Map<string, { total: number; checkedIn: number }>()
    for (const r of registrations) {
      const c = m.get(r.event_id) ?? { total: 0, checkedIn: 0 }
      c.total += 1
      if (r.checked_in) c.checkedIn += 1
      m.set(r.event_id, c)
    }
    return m
  }, [registrations])

  function startCreate() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(ev: EventListing) {
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      event_date: ev.event_date ?? '',
      start_time: ev.start_time ?? '',
      end_time: ev.end_time ?? '',
      location: ev.location ?? '',
      image_url: ev.image_url ?? '',
      event_url: ev.event_url ?? '',
      capacity: ev.capacity !== null ? String(ev.capacity) : '',
      registration_deadline: ev.registration_deadline ? toLocalInputValue(ev.registration_deadline) : '',
      status: ev.status,
    })
    setEditingId(ev.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.event_date) { showToast('Title and date are required'); return }
    const capacityValue = form.capacity.trim() ? Number(form.capacity) : null
    if (capacityValue !== null && (!Number.isInteger(capacityValue) || capacityValue <= 0)) {
      showToast('Capacity must be a whole number greater than 0, or blank for unlimited')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: form.event_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      location: form.location.trim() || null,
      image_url: form.image_url.trim() || null,
      event_url: form.event_url.trim() || null,
      capacity: capacityValue,
      registration_deadline: form.registration_deadline ? new Date(form.registration_deadline).toISOString() : null,
      status: form.status as EventListingStatus,
    }

    const ok = editingId
      ? await runAdminAction(() => supabase.from('events').update(payload).eq('id', editingId), showToast, { successMessage: 'Event updated' })
      : await runAdminAction(() => supabase.from('events').insert(payload), showToast, { successMessage: 'Event created' })

    setSaving(false)
    if (!ok) return
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
    await load()
  }

  async function toggleRegistrationOpen(ev: EventListing) {
    const ok = await runAdminAction(
      () => supabase.from('events').update({ registration_open: !ev.registration_open }).eq('id', ev.id),
      showToast,
      { successMessage: ev.registration_open ? 'Registration closed' : 'Registration reopened' },
    )
    if (ok) await load()
  }

  async function cancelEvent(ev: EventListing) {
    const ok = await runAdminAction(
      () => supabase.from('events').update({ status: 'cancelled', registration_open: false }).eq('id', ev.id),
      showToast,
      { confirmMessage: `Cancel "${ev.title}"? It stays visible (marked cancelled) but registration closes immediately.`, successMessage: 'Event cancelled' },
    )
    if (ok) await load()
  }

  async function deleteEvent(ev: EventListing) {
    const ok = await runAdminAction(
      () => supabase.from('events').delete().eq('id', ev.id),
      showToast,
      { confirmMessage: `Permanently delete "${ev.title}" and all its registrations? This cannot be undone.`, successMessage: 'Event deleted' },
    )
    if (ok) {
      if (activeEventId === ev.id) setActiveEventId(null)
      await load()
    }
  }

  const activeEvent = events.find((e) => e.id === activeEventId) ?? null

  return (
    <div>
      {!activeEvent ? (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={startCreate} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple">
              + New Event
            </button>
          </div>

          {showForm && (
            <EventForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} editing={!!editingId} />
          )}

          {loading ? (
            <div className="text-white/40 text-sm py-10 text-center">Loading…</div>
          ) : loadError ? (
            <div className="text-rose-300 text-sm py-10 text-center">Couldn't load events: {loadError}</div>
          ) : events.length === 0 ? (
            <div className="text-white/40 text-sm py-10 text-center">No events yet — create one above.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((ev) => {
                const c = counts.get(ev.id) ?? { total: 0, checkedIn: 0 }
                return (
                  <div key={ev.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-sm flex items-center gap-2 flex-wrap">
                        {ev.title}
                        <StatusBadge status={ev.status} />
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${ev.registration_open ? 'text-emerald-300 border-emerald-300/30' : 'text-white/40 border-white/20'}`}>
                          {ev.registration_open ? 'registration open' : 'registration closed'}
                        </span>
                      </div>
                      <div className="text-white/40 text-xs mt-1">
                        {formatEventDate(ev.event_date)} · {ev.location || 'No location set'} · {c.total}{ev.capacity !== null ? `/${ev.capacity}` : ''} registered · {c.checkedIn} checked in
                      </div>
                    </div>
                    <div className="flex gap-2 flex-none flex-wrap">
                      <button onClick={() => setActiveEventId(ev.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-purple/30 text-purple-light hover:bg-purple/10">
                        View Attendees ({c.total})
                      </button>
                      <button onClick={() => startEdit(ev)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">Edit</button>
                      <button onClick={() => toggleRegistrationOpen(ev)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
                        {ev.registration_open ? 'Close registration' : 'Reopen registration'}
                      </button>
                      {ev.status !== 'cancelled' && (
                        <button onClick={() => cancelEvent(ev)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-400/30 text-amber-300 hover:bg-amber-400/10">Cancel</button>
                      )}
                      <button onClick={() => deleteEvent(ev)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white/40 hover:bg-white/5">Delete</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <AttendeeList
          event={activeEvent}
          registrations={registrations.filter((r) => r.event_id === activeEvent.id)}
          onBack={() => setActiveEventId(null)}
          onOpenDetail={setDetail}
          showToast={showToast}
          onChanged={load}
        />
      )}

      {detail && <RegistrationDetailModal reg={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function StatusBadge({ status }: { status: EventListingStatus }) {
  const styles: Record<EventListingStatus, string> = {
    draft: 'text-white/40 border-white/20',
    published: 'text-emerald-300 border-emerald-300/30',
    cancelled: 'text-rose-300 border-rose-300/30',
  }
  return <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${styles[status]}`}>{status}</span>
}

function EventForm({
  form, setForm, onSave, onCancel, saving, editing,
}: {
  form: Record<string, string>
  setForm: (f: Record<string, string>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  editing: boolean
}) {
  function set(name: string, value: string) {
    setForm({ ...form, [name]: value })
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-6">
      <div className="text-xs text-purple-light font-semibold mb-3">{editing ? 'Editing event' : 'New event'}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LabeledInput label="Title *" value={form.title} onChange={(v) => set('title', v)} />
        <LabeledInput label="Location" value={form.location} onChange={(v) => set('location', v)} />
        <LabeledInput label="Date *" type="date" value={form.event_date} onChange={(v) => set('event_date', v)} />
        <LabeledInput label="Capacity (blank = unlimited)" type="number" value={form.capacity} onChange={(v) => set('capacity', v)} />
        <LabeledInput label="Start time" type="time" value={form.start_time} onChange={(v) => set('start_time', v)} />
        <LabeledInput label="End time" type="time" value={form.end_time} onChange={(v) => set('end_time', v)} />
        <LabeledInput label="Registration deadline" type="datetime-local" value={form.registration_deadline} onChange={(v) => set('registration_deadline', v)} />
        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input w-full text-sm">
            <option value="draft" className="bg-panel">Draft (hidden from public)</option>
            <option value="published" className="bg-panel">Published</option>
            <option value="cancelled" className="bg-panel">Cancelled</option>
          </select>
        </div>
        <LabeledInput label="Image URL" value={form.image_url} onChange={(v) => set('image_url', v)} />
        <LabeledInput label="Event link (optional)" value={form.event_url} onChange={(v) => set('event_url', v)} />
        <div className="sm:col-span-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} className="input w-full text-sm resize-y" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Event'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">Cancel</button>
      </div>
    </div>
  )
}

function LabeledInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-wider text-white/40 block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input w-full text-sm" />
    </div>
  )
}

function AttendeeList({
  event, registrations, onBack, onOpenDetail, showToast, onChanged,
}: {
  event: EventListing
  registrations: EventRegistration[]
  onBack: () => void
  onOpenDetail: (r: EventRegistration) => void
  showToast: (msg: string) => void
  onChanged: () => void
}) {
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const filtered = registrations.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.invite_code.toLowerCase().includes(q)
  })

  function copyCode(r: EventRegistration) {
    navigator.clipboard.writeText(r.invite_code).catch(() => {})
    setCopiedId(r.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function resend(r: EventRegistration) {
    setResendingId(r.id)
    const { data: { session } } = await supabase.auth.getSession()
    const { ok } = await sendInviteEmail({ registrationId: r.id, accessToken: session?.access_token })
    setResendingId(null)
    showToast(ok ? `Email resent to ${r.email}` : 'Could not send the email — check the Netlify function / Resend configuration')
    onChanged()
  }

  function exportCsv() {
    const headers = ['full_name', 'email', 'country', 'twitter', 'phone', 'wallet_address', 'invite_code', 'checked_in', 'checked_in_at', 'created_at']
    const rows = registrations.map((r) => headers.map((h) => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-registrations.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <button onClick={onBack} className="text-xs text-white/50 hover:text-white flex items-center gap-1.5">
          ← All events
        </button>
        <button onClick={exportCsv} disabled={registrations.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-40">
          <Download size={13} /> Export CSV
        </button>
      </div>

      <h4 className="font-display font-semibold text-lg mb-1">{event.title}</h4>
      <p className="text-white/40 text-xs mb-4">{registrations.length} registered · {registrations.filter((r) => r.checked_in).length} checked in</p>

      <div className="relative max-w-sm mb-5">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, or code…" className="input w-full pl-9 text-sm" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No registrations match.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  {r.full_name}
                  {r.checked_in ? (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-emerald-300/30 text-emerald-300">checked in</span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/20 text-white/40">not checked in</span>
                  )}
                  {!r.email_sent && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-amber-300/30 text-amber-300">email not sent</span>
                  )}
                </div>
                <div className="text-white/40 text-xs mt-0.5">{r.email} · <code className="text-purple-light">{r.invite_code}</code></div>
              </div>
              <div className="flex gap-2 flex-none">
                <button onClick={() => copyCode(r)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
                  <Copy size={12} /> {copiedId === r.id ? 'Copied' : 'Copy code'}
                </button>
                <button onClick={() => resend(r)} disabled={resendingId === r.id} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-50">
                  <Mail size={12} /> {resendingId === r.id ? 'Sending…' : 'Resend email'}
                </button>
                <button onClick={() => onOpenDetail(r)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">View</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RegistrationDetailModal({ reg, onClose }: { reg: EventRegistration; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 relative">
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white"><X size={16} /></button>
        <h3 className="font-display font-semibold text-lg mb-4">Registration details</h3>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <DetailRow label="Full name" value={reg.full_name} />
          <DetailRow label="Email" value={reg.email} />
          <DetailRow label="Country" value={reg.country} />
          <DetailRow label="X / Twitter" value={reg.twitter || '—'} />
          <DetailRow label="Phone" value={reg.phone || '—'} />
          <DetailRow label="Wallet address" value={reg.wallet_address || '—'} mono />
          <DetailRow label="Invite code" value={reg.invite_code} mono />
          <DetailRow label="Checked in" value={reg.checked_in ? `Yes — ${new Date(reg.checked_in_at!).toLocaleString()}` : 'No'} />
          <DetailRow label="Email sent" value={reg.email_sent ? `Yes — ${new Date(reg.email_sent_at!).toLocaleString()}` : reg.email_last_error ? `Failed: ${reg.email_last_error}` : 'Not yet'} />
          <DetailRow label="Registered" value={new Date(reg.created_at).toLocaleString()} />
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-white/40">{label}</div>
      <div className={`text-white/80 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  )
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time, not the
// UTC ISO string Postgres/Supabase hands back.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
