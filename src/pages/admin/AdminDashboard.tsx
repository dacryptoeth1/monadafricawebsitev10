import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import type { Application, Bounty, SiteSettings, Submission } from '../../types'
import { defaultSiteSettings } from '../../types'
import AdminCollectionPanel from './AdminCollectionPanel'

type Tab = 'pending' | 'approved' | 'rejected' | 'applications' | 'submissions' | 'projects' | 'resources' | 'videos' | 'partners' | 'events' | 'news' | 'settings'

const TABS: [Tab, string][] = [
  ['pending', 'Pending Bounties'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['applications', 'Applications'],
  ['submissions', 'Submissions'],
  ['projects', 'Ecosystem Projects'],
  ['resources', 'Resources'],
  ['videos', 'Videos'],
  ['partners', 'Partners'],
  ['events', 'Events'],
  ['news', 'News'],
  ['settings', 'Settings'],
]

export default function AdminDashboard() {
  const { session, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('pending')
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  async function loadBounties() {
    const { data } = await supabase.from('bounties').select('*').order('created_at', { ascending: false })
    setBounties((data as Bounty[]) ?? [])
  }
  async function loadApplications() {
    const { data } = await supabase.from('applications').select('*').order('created_at', { ascending: false })
    setApplications((data as Application[]) ?? [])
  }
  async function loadSubmissions() {
    const { data } = await supabase.from('submissions').select('*').order('created_at', { ascending: false })
    setSubmissions((data as Submission[]) ?? [])
  }

  useEffect(() => {
    Promise.all([loadBounties(), loadApplications(), loadSubmissions()]).then(() => setLoading(false))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function updateStatus(id: string, status: Bounty['status']) {
    await supabase.from('bounties').update({ status }).eq('id', id)
    if (status === 'approved') {
      const bounty = bounties.find((b) => b.id === id)
      await supabase.from('notifications').insert({
        user_id: null, // broadcast to everyone
        type: 'new_bounty',
        title: 'New bounty live',
        message: bounty ? `${bounty.title} just went live on the bounty board.` : 'A new bounty just went live.',
      })
    }
    await loadBounties()
    showToast(`Marked ${status}`)
  }

  async function removeBounty(id: string) {
    if (!confirm('Delete this bounty permanently?')) return
    await supabase.from('bounties').delete().eq('id', id)
    await loadBounties()
    showToast('Deleted')
  }

  async function updateApplicationStatus(app: Application, status: 'approved' | 'rejected') {
    await supabase.from('applications').update({ status }).eq('id', app.id)
    if (app.user_id) {
      await supabase.from('notifications').insert({
        user_id: app.user_id,
        type: 'application_update',
        title: status === 'approved' ? 'Application approved' : 'Application update',
        message: status === 'approved'
          ? 'Your bounty application was approved — you can now submit your work.'
          : 'Your bounty application was not approved this time.',
      })
    }
    await loadApplications()
    showToast(`Application ${status}`)
  }

  async function updateSubmissionStatus(sub: Submission, status: 'approved' | 'rejected') {
    await supabase.from('submissions').update({ status }).eq('id', sub.id)
    await supabase.from('notifications').insert({
      user_id: sub.user_id,
      type: status === 'approved' ? 'submission_accepted' : 'submission_rejected',
      title: status === 'approved' ? 'Submission accepted' : 'Submission rejected',
      message: status === 'approved'
        ? 'Your bounty submission was accepted. Nice work!'
        : 'Your bounty submission was not accepted this time.',
    })
    await loadSubmissions()
    showToast(`Submission ${status}`)
  }

  function exportSubmissionsCsv() {
    const headers = ['id', 'bounty_id', 'user_id', 'status', 'github_repo', 'x_post_link', 'google_docs_link', 'website_link', 'file_url', 'additional_notes', 'created_at']
    const rows = submissions.map((s) =>
      headers.map((h) => {
        const val = (s as any)[h] ?? ''
        const escaped = String(val).replace(/"/g, '""')
        return `"${escaped}"`
      }).join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monad-africa-submissions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pending = bounties.filter((b) => b.status === 'pending')
  const approved = bounties.filter((b) => b.status === 'approved')
  const rejected = bounties.filter((b) => b.status === 'rejected')

  return (
    <div className="min-h-screen bg-ink pt-10 pb-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-semibold text-2xl">Admin Dashboard</h1>
            <p className="text-white/40 text-xs mt-1">Signed in as {session?.user.email}</p>
          </div>
          <button onClick={() => signOut()} className="px-4 py-2 rounded-full text-sm border border-white/15 hover:bg-white/5 transition-colors">
            Sign Out
          </button>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                tab === key ? 'bg-purple border-purple text-white' : 'border-white/15 text-white/55 hover:bg-white/5'
              }`}
            >
              {label}
              {key === 'pending' && pending.length > 0 && ` (${pending.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-white/40 text-sm">Loading…</div>
        ) : tab === 'settings' ? (
          <SettingsPanel onSaved={() => showToast('Settings saved')} />
        ) : tab === 'applications' ? (
          <ApplicationsList items={applications} onApprove={(a) => updateApplicationStatus(a, 'approved')} onReject={(a) => updateApplicationStatus(a, 'rejected')} />
        ) : tab === 'submissions' ? (
          <SubmissionsList items={submissions} onApprove={(s) => updateSubmissionStatus(s, 'approved')} onReject={(s) => updateSubmissionStatus(s, 'rejected')} onExport={exportSubmissionsCsv} />
        ) : tab === 'projects' ? (
          <AdminCollectionPanel
            table="projects"
            titleField="name"
            subtitleField="category"
            fields={[
              { name: 'name', label: 'Project Name', placeholder: 'Aurora Finance' },
              { name: 'logo_url', label: 'Logo URL', type: 'url' },
              { name: 'website', label: 'Website', type: 'url' },
              { name: 'category', label: 'Category', placeholder: 'DeFi' },
              { name: 'description', label: 'Description', type: 'textarea' },
            ]}
          />
        ) : tab === 'resources' ? (
          <AdminCollectionPanel
            table="resources"
            titleField="title"
            subtitleField="url"
            fields={[
              { name: 'title', label: 'Title' },
              { name: 'url', label: 'URL', type: 'url' },
              { name: 'type', label: 'Type', placeholder: 'guide / docs / tool' },
              { name: 'description', label: 'Description', type: 'textarea' },
            ]}
          />
        ) : tab === 'videos' ? (
          <AdminCollectionPanel
            table="videos"
            titleField="title"
            subtitleField="youtube_url"
            fields={[
              { name: 'title', label: 'Title' },
              { name: 'youtube_url', label: 'YouTube Embed URL', type: 'url', placeholder: 'https://www.youtube.com/embed/...' },
              { name: 'description', label: 'Description', type: 'textarea' },
            ]}
          />
        ) : tab === 'partners' ? (
          <AdminCollectionPanel
            table="partners"
            titleField="name"
            subtitleField="website"
            fields={[
              { name: 'name', label: 'Name' },
              { name: 'logo_url', label: 'Logo URL', type: 'url' },
              { name: 'website', label: 'Website', type: 'url' },
            ]}
          />
        ) : tab === 'events' ? (
          <AdminCollectionPanel
            table="events"
            titleField="title"
            subtitleField="event_date"
            fields={[
              { name: 'title', label: 'Title' },
              { name: 'event_type', label: 'Type', placeholder: 'Meetup / Workshop / X Space' },
              { name: 'event_date', label: 'Date', type: 'text', placeholder: 'YYYY-MM-DD' },
              { name: 'link', label: 'Link', type: 'url' },
              { name: 'description', label: 'Description', type: 'textarea' },
            ]}
            onAdded={async () => {
              await supabase.from('notifications').insert({
                user_id: null,
                type: 'event_announced',
                title: 'New event announced',
                message: 'Check the homepage for details on the latest Monad Africa event.',
              })
            }}
          />
        ) : tab === 'news' ? (
          <AdminCollectionPanel
            table="news"
            titleField="title"
            subtitleField="link"
            fields={[
              { name: 'title', label: 'Title' },
              { name: 'link', label: 'Link', type: 'url' },
              { name: 'summary', label: 'Summary', type: 'textarea' },
            ]}
          />
        ) : (
          <BountyList
            items={tab === 'pending' ? pending : tab === 'approved' ? approved : rejected}
            tab={tab}
            onApprove={(id) => updateStatus(id, 'approved')}
            onReject={(id) => updateStatus(id, 'rejected')}
            onRestore={(id) => updateStatus(id, 'pending')}
            onDelete={removeBounty}
          />
        )}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-panel border border-white/15 px-6 py-3 rounded-full text-sm z-50">{toast}</div>}
    </div>
  )
}

function BountyList({
  items,
  tab,
  onApprove,
  onReject,
  onRestore,
  onDelete,
}: {
  items: Bounty[]
  tab: Tab
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (items.length === 0) return <div className="text-white/40 text-sm py-10 text-center">Nothing here.</div>
  return (
    <div className="flex flex-col gap-3">
      {items.map((b) => (
        <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-display font-semibold">
              {b.title}{' '}
              <span className={`ml-2 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                b.status === 'approved' ? 'text-emerald-300 border-emerald-300/30' : b.status === 'rejected' ? 'text-rose-300 border-rose-300/30' : 'text-amber-300 border-amber-300/30'
              }`}>{b.status}</span>
            </div>
            <div className="text-white/40 text-xs mt-1">{b.project_name} · {b.reward} · {b.category} · due {b.deadline} · {b.contact_email}</div>
          </div>
          <div className="flex gap-2 flex-none">
            {tab !== 'approved' && <button onClick={() => onApprove(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/25">Approve</button>}
            {tab !== 'rejected' && <button onClick={() => onReject(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-400/15 text-rose-300 border border-rose-400/30 hover:bg-rose-400/25">Reject</button>}
            {tab !== 'pending' && <button onClick={() => onRestore(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white/60 hover:bg-white/5">Back to pending</button>}
            <button onClick={() => onDelete(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white/40 hover:bg-white/5">Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ApplicationsList({ items, onApprove, onReject }: { items: Application[]; onApprove: (a: Application) => void; onReject: (a: Application) => void }) {
  if (items.length === 0) return <div className="text-white/40 text-sm py-10 text-center">No applications yet.</div>
  return (
    <div className="flex flex-col gap-3">
      {items.map((a) => (
        <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-display font-semibold">
              {a.full_name} <span className="text-white/40 font-normal text-sm">— {a.email}</span>{' '}
              <span className={`ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                a.status === 'approved' ? 'text-emerald-300 border-emerald-300/30' : a.status === 'rejected' ? 'text-rose-300 border-rose-300/30' : 'text-amber-300 border-amber-300/30'
              }`}>{a.status}</span>
            </div>
            {a.portfolio_link && <a href={a.portfolio_link} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">{a.portfolio_link}</a>}
            {a.message && <p className="text-white/50 text-xs mt-1 max-w-lg">{a.message}</p>}
          </div>
          <div className="flex gap-2 flex-none">
            {a.status !== 'approved' && <button onClick={() => onApprove(a)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/25">Approve</button>}
            {a.status !== 'rejected' && <button onClick={() => onReject(a)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-400/15 text-rose-300 border border-rose-400/30 hover:bg-rose-400/25">Reject</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function SubmissionsList({
  items,
  onApprove,
  onReject,
  onExport,
}: {
  items: Submission[]
  onApprove: (s: Submission) => void
  onReject: (s: Submission) => void
  onExport: () => void
}) {
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={onExport} disabled={items.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-40 transition-colors">
          <Download size={13} /> Export CSV
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No submissions yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm">
                  Bounty {s.bounty_id.slice(0, 8)}…{' '}
                  <span className={`ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                    s.status === 'approved' ? 'text-emerald-300 border-emerald-300/30' : s.status === 'rejected' ? 'text-rose-300 border-rose-300/30' : 'text-amber-300 border-amber-300/30'
                  }`}>{s.status}</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {s.github_repo && <a href={s.github_repo} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">GitHub</a>}
                  {s.x_post_link && <a href={s.x_post_link} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">X Post</a>}
                  {s.google_docs_link && <a href={s.google_docs_link} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">Docs</a>}
                  {s.website_link && <a href={s.website_link} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">Website</a>}
                  {s.file_url && <a href={s.file_url} target="_blank" rel="noopener noreferrer" className="text-purple-light text-xs">File</a>}
                </div>
                {s.additional_notes && <p className="text-white/50 text-xs mt-1 max-w-lg">{s.additional_notes}</p>}
              </div>
              <div className="flex gap-2 flex-none">
                {s.status !== 'approved' && <button onClick={() => onApprove(s)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/25">Approve</button>}
                {s.status !== 'rejected' && <button onClick={() => onReject(s)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-400/15 text-rose-300 border border-rose-400/30 hover:bg-rose-400/25">Reject</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data as SiteSettings)
      setLoaded(true)
    })
  }, [])

  async function save() {
    await supabase.from('site_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', 1)
    onSaved()
  }

  if (!loaded) return <div className="text-white/40 text-sm">Loading…</div>

  return (
    <div className="max-w-xl">
      <p className="text-white/40 text-xs mb-6 leading-relaxed">These numbers display publicly. Keep them accurate.</p>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <NumField label="X Followers" value={settings.x_followers} onChange={(v) => setSettings({ ...settings, x_followers: v })} />
        <NumField label="Discord Members" value={settings.discord_members} onChange={(v) => setSettings({ ...settings, discord_members: v })} />
        <NumField label="Countries Reached" value={settings.countries_reached} onChange={(v) => setSettings({ ...settings, countries_reached: v })} />
        <NumField label="Builders Onboarded" value={settings.builders_onboarded} onChange={(v) => setSettings({ ...settings, builders_onboarded: v })} />
        <NumField label="Community Partners" value={settings.community_partners} onChange={(v) => setSettings({ ...settings, community_partners: v })} />
      </div>
      <div className="grid grid-cols-1 gap-4 mb-6">
        <TextField label="X URL" value={settings.x_url} onChange={(v) => setSettings({ ...settings, x_url: v })} />
        <TextField label="Discord Invite URL" value={settings.discord_url} onChange={(v) => setSettings({ ...settings, discord_url: v })} />
        <TextField label="Telegram URL (optional)" value={settings.telegram_url} onChange={(v) => setSettings({ ...settings, telegram_url: v })} />
      </div>
      <button onClick={save} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple">Save Settings</button>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="input" />
    </div>
  )
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  )
}
