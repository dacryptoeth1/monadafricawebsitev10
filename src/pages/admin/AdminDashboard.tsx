import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { runAdminAction } from '../../lib/adminActions'
import type { Application, Bounty, EcosystemProject, Submission } from '../../types'
import AdminCollectionPanel from './AdminCollectionPanel'
import AdminOverview from './AdminOverview'
import AdminAnalytics from './AdminAnalytics'
import AdminAnnouncements from './AdminAnnouncements'
import AdminHomepage from './AdminHomepage'
import AdminRoles from './AdminRoles'
import AdminCredits from './AdminCredits'
import AdminXpConfig from './AdminXpConfig'
import AdminLeaderboardView from './AdminLeaderboardView'
import AdminReports from './AdminReports'
import AdminUsers from './AdminUsers'
import AdminSettings from './AdminSettings'
import MonadMark from '../../components/MonadMark'

// Safety cap on the three top-level lists this dashboard loads in full
// (bounties/applications/submissions back every bounty-lifecycle tab
// and the CSV export, so — unlike Users/Credits/XP — they can't easily
// move to server-side pagination without restructuring those tabs).
// 1000 rows covers realistic volume for this app for a long time; if
// it's ever hit, the newest 1000 win and older rows silently drop off
// this view (still fully present in the database and exportable via
// direct SQL) — flagged here rather than left as an invisible ceiling.
const LIST_SAFETY_LIMIT = 1000

type Tab = 'overview' | 'analytics' | 'pending' | 'approved' | 'rejected' | 'applications' | 'submissions' | 'users' | 'roles' | 'credits' | 'xp' | 'leaderboard' | 'reports' | 'projects' | 'resources' | 'videos' | 'partners' | 'events' | 'news' | 'announcements' | 'homepage' | 'settings'

const TABS: [Tab, string, boolean][] = [
  // third element: true = staff-admin+ only (hidden from Moderators)
  ['submissions', 'Submissions', false],
  ['applications', 'Applications', false],
  ['users', 'Users', false], // visible to moderators too, but with fewer buttons — see AdminUsers
  ['reports', 'Reports', false], // Moderator "View reports" capability
  ['overview', 'Overview', true],
  ['analytics', 'Analytics', true],
  ['roles', 'Roles', true],
  ['credits', 'Credits', true],
  ['xp', 'XP', true],
  ['leaderboard', 'Leaderboard', true],
  ['pending', 'Pending Bounties', true],
  ['approved', 'Approved', true],
  ['rejected', 'Rejected', true],
  ['projects', 'Ecosystem Projects', true],
  ['resources', 'Resources', true],
  ['videos', 'Videos', true],
  ['partners', 'Partners', true],
  ['events', 'Events', true],
  ['news', 'News', true],
  ['announcements', 'Announcements', true],
  ['homepage', 'Homepage', true],
  ['settings', 'Settings', true],
]

export default function AdminDashboard() {
  const { session, signOut, adminRole } = useAuth()
  const isStaffAdmin = adminRole === 'super_admin' || adminRole === 'admin'
  const visibleTabs = TABS.filter(([, , staffOnly]) => !staffOnly || isStaffAdmin)
  const [tab, setTab] = useState<Tab>(isStaffAdmin ? 'overview' : 'submissions')
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!isStaffAdmin && !['submissions', 'applications', 'users', 'reports'].includes(tab)) {
      setTab('submissions')
    }
  }, [isStaffAdmin, tab])

  async function loadBounties() {
    const { data, error } = await supabase.from('bounties').select('*').order('created_at', { ascending: false }).limit(LIST_SAFETY_LIMIT)
    if (error) { showToast(error.message); return }
    setBounties((data as Bounty[]) ?? [])
  }
  async function loadApplications() {
    const { data, error } = await supabase.from('applications').select('*').order('created_at', { ascending: false }).limit(LIST_SAFETY_LIMIT)
    if (error) { showToast(error.message); return }
    setApplications((data as Application[]) ?? [])
  }
  async function loadSubmissions() {
    const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(LIST_SAFETY_LIMIT)
    if (error) { showToast(error.message); return }
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
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ status }).eq('id', id),
      showToast,
    )
    if (!ok) return
    if (status === 'approved') {
      const bounty = bounties.find((b) => b.id === id)
      const { error } = await supabase.from('notifications').insert({
        user_id: null, // broadcast to everyone
        type: 'new_bounty',
        title: 'New bounty live',
        message: bounty ? `${bounty.title} just went live on the bounty board.` : 'A new bounty just went live.',
      })
      if (error) showToast(`Bounty ${status}, but the broadcast notification failed: ${error.message}`)
    }
    await loadBounties()
    showToast(`Marked ${status}`)
  }

  async function removeBounty(id: string) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').delete().eq('id', id),
      showToast,
      { confirmMessage: 'Delete this bounty permanently?', successMessage: 'Deleted' },
    )
    if (ok) await loadBounties()
  }

  async function toggleClosed(id: string, closed: boolean) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ is_closed: closed }).eq('id', id),
      showToast,
      { successMessage: closed ? 'Bounty closed' : 'Bounty reopened' },
    )
    if (ok) await loadBounties()
  }

  async function toggleFeatured(id: string, featured: boolean) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ is_featured: featured }).eq('id', id),
      showToast,
      { successMessage: featured ? 'Bounty featured' : 'Bounty unfeatured' },
    )
    if (ok) await loadBounties()
  }

  async function updateApplicationStatus(app: Application, status: 'approved' | 'rejected') {
    const ok = await runAdminAction(
      () => supabase.from('applications').update({ status }).eq('id', app.id),
      showToast,
    )
    if (!ok) return
    if (app.user_id) {
      const { error } = await supabase.from('notifications').insert({
        user_id: app.user_id,
        type: 'application_update',
        title: status === 'approved' ? 'Application approved' : 'Application update',
        message: status === 'approved'
          ? 'Your bounty application was approved — you can now submit your work.'
          : 'Your bounty application was not approved this time.',
      })
      if (error) showToast(`Application ${status}, but the notification failed: ${error.message}`)
    }
    await loadApplications()
    showToast(`Application ${status}`)
  }

  async function updateSubmissionStatus(sub: Submission, status: 'approved' | 'rejected') {
    // Both directions go through an RPC so status change + XP/badge (on
    // approval) + notification all happen atomically server-side —
    // rejection used to be a plain UPDATE plus a separate insert, which
    // could leave a rejected submission with no notification sent if
    // the second call failed.
    const rpc = status === 'approved' ? 'admin_approve_submission' : 'admin_reject_submission'
    const { error } = await supabase.rpc(rpc, { p_submission_id: sub.id })
    if (error) { showToast(error.message); return }
    await loadSubmissions()
    showToast(`Submission ${status}`)
  }

  async function markSubmissionWinner(sub: Submission) {
    const { error } = await supabase.rpc('admin_mark_submission_winner', { p_submission_id: sub.id })
    if (error) { showToast(error.message); return }
    await loadSubmissions()
    showToast('🏆 Marked as winner — bonus XP awarded')
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
            <h1 className="font-display font-semibold text-2xl flex items-center gap-2"><MonadMark size={22} /> Admin Dashboard</h1>
            <p className="text-white/40 text-xs mt-1">Signed in as {session?.user.email}</p>
          </div>
          <button onClick={() => signOut()} className="px-4 py-2 rounded-full text-sm border border-white/15 hover:bg-white/5 transition-colors">
            Sign Out
          </button>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {visibleTabs.map(([key, label]) => (
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
        ) : tab === 'overview' ? (
          <AdminOverview showToast={showToast} />
        ) : tab === 'analytics' ? (
          <AdminAnalytics showToast={showToast} />
        ) : tab === 'roles' ? (
          <AdminRoles showToast={showToast} />
        ) : tab === 'credits' ? (
          <AdminCredits showToast={showToast} />
        ) : tab === 'xp' ? (
          <AdminXpConfig showToast={showToast} />
        ) : tab === 'leaderboard' ? (
          <AdminLeaderboardView showToast={showToast} />
        ) : tab === 'reports' ? (
          <AdminReports showToast={showToast} />
        ) : tab === 'settings' ? (
          <AdminSettings showToast={showToast} />
        ) : tab === 'announcements' ? (
          <AdminAnnouncements showToast={showToast} />
        ) : tab === 'homepage' ? (
          <AdminHomepage showToast={showToast} />
        ) : tab === 'applications' ? (
          <ApplicationsList items={applications} onApprove={(a) => updateApplicationStatus(a, 'approved')} onReject={(a) => updateApplicationStatus(a, 'rejected')} />
        ) : tab === 'submissions' ? (
          <SubmissionsList items={submissions} onApprove={(s) => updateSubmissionStatus(s, 'approved')} onReject={(s) => updateSubmissionStatus(s, 'rejected')} onExport={exportSubmissionsCsv} onMarkWinner={markSubmissionWinner} />
        ) : tab === 'users' ? (
          <AdminUsers showToast={showToast} isStaffAdmin={isStaffAdmin} />
        ) : tab === 'projects' ? (
          <div>
            <AdminCollectionPanel
              showToast={showToast}
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
            <FeaturedProjectsToggle showToast={showToast} />
          </div>
        ) : tab === 'resources' ? (
          <AdminCollectionPanel
            showToast={showToast}
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
            showToast={showToast}
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
            showToast={showToast}
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
            showToast={showToast}
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
            showToast={showToast}
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
            onClose={(id) => toggleClosed(id, true)}
            onReopen={(id) => toggleClosed(id, false)}
            onToggleFeatured={(id, f) => toggleFeatured(id, f)}
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
  onClose,
  onReopen,
  onToggleFeatured,
}: {
  items: Bounty[]
  tab: Tab
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  onClose: (id: string) => void
  onReopen: (id: string) => void
  onToggleFeatured: (id: string, featured: boolean) => void
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
              {b.is_closed && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/20 text-white/50">closed</span>}
              {b.is_featured && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-gold/40 text-gold">featured</span>}
            </div>
            <div className="text-white/40 text-xs mt-1">{b.project_name} · {b.reward} · {b.category} · due {b.deadline} · {b.contact_email}</div>
          </div>
          <div className="flex gap-2 flex-none">
            {tab !== 'approved' && <button onClick={() => onApprove(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-400/25">Approve</button>}
            {tab !== 'rejected' && <button onClick={() => onReject(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-400/15 text-rose-300 border border-rose-400/30 hover:bg-rose-400/25">Reject</button>}
            {tab === 'approved' && !b.is_closed && <button onClick={() => onClose(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white/60 hover:bg-white/5">Close</button>}
            {tab === 'approved' && b.is_closed && <button onClick={() => onReopen(b.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10">Reopen</button>}
            {tab === 'approved' && (
              <button onClick={() => onToggleFeatured(b.id, !b.is_featured)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-gold/30 text-gold hover:bg-gold/10">
                {b.is_featured ? 'Unfeature' : 'Feature'}
              </button>
            )}
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
  onMarkWinner,
}: {
  items: Submission[]
  onApprove: (s: Submission) => void
  onReject: (s: Submission) => void
  onExport: () => void
  onMarkWinner: (s: Submission) => void
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
                  {s.is_winner && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-gold/40 text-gold">🏆 winner</span>}
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
                {s.status === 'approved' && !s.is_winner && (
                  <button onClick={() => onMarkWinner(s)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25">🏆 Mark Winner</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FeaturedProjectsToggle({ showToast }: { showToast: (msg: string) => void }) {
  const [projects, setProjects] = useState<EcosystemProject[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data, error } = await supabase.from('projects').select('*').order('name', { ascending: true })
    if (error) showToast(error.message)
    setProjects((data as EcosystemProject[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle(id: string, featured: boolean) {
    const ok = await runAdminAction(
      () => supabase.from('projects').update({ is_featured: featured }).eq('id', id),
      showToast,
      { successMessage: featured ? 'Added to Featured Projects carousel' : 'Removed from carousel' },
    )
    if (ok) await load()
  }

  if (loading || projects.length === 0) return null

  return (
    <div className="mt-8 pt-8 border-t border-white/10">
      <h4 className="text-sm font-semibold mb-3">Featured Projects (shown in the homepage carousel)</h4>
      <div className="flex flex-col gap-2">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
            <span className="text-sm">{p.name}</span>
            <button
              onClick={() => toggle(p.id, !p.is_featured)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${p.is_featured ? 'border-gold/40 text-gold bg-gold/10' : 'border-white/15 text-white/50'}`}
            >
              {p.is_featured ? 'Featured' : 'Feature'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
