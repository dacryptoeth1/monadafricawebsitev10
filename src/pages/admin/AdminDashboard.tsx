import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { runAdminAction } from '../../lib/adminActions'
import { logError } from '../../lib/errors'
import type { Application, Bounty, EcosystemProject, Submission } from '../../types'
import AdminCollectionPanel from './AdminCollectionPanel'
import type { BountyDraft } from './AdminBounties'
import MonadMark from '../../components/MonadMark'

// Every tab below this point is its own chunk, only fetched the moment
// an admin actually clicks that tab — this dashboard already only ships
// to authenticated admins (AdminRoute), but a moderator who only ever
// touches Submissions/Applications/Users/Reports/Check-In was still
// downloading every staff-admin tab's code (Analytics + Overview alone
// pull in recharts) on first load. Splitting per-tab means a
// moderator's session, and a staff admin who lands on one tab and
// leaves, now only pays for the code they actually use.
const AdminBounties = lazy(() => import('./AdminBounties'))
const AdminOverview = lazy(() => import('./AdminOverview'))
const AdminAnalytics = lazy(() => import('./AdminAnalytics'))
const AdminAnnouncements = lazy(() => import('./AdminAnnouncements'))
const AdminHomepage = lazy(() => import('./AdminHomepage'))
const AdminRoles = lazy(() => import('./AdminRoles'))
const AdminCredits = lazy(() => import('./AdminCredits'))
const AdminXpConfig = lazy(() => import('./AdminXpConfig'))
const AdminLeaderboardView = lazy(() => import('./AdminLeaderboardView'))
const AdminReports = lazy(() => import('./AdminReports'))
const AdminUsers = lazy(() => import('./AdminUsers'))
const AdminSettings = lazy(() => import('./AdminSettings'))
const AdminEventRegistrations = lazy(() => import('./AdminEventRegistrations'))
const AdminCheckIn = lazy(() => import('./AdminCheckIn'))

// Safety cap on the three top-level lists this dashboard loads in full
// (bounties/applications/submissions back every bounty-lifecycle tab
// and the CSV export, so — unlike Users/Credits/XP — they can't easily
// move to server-side pagination without restructuring those tabs).
// 1000 rows covers realistic volume for this app for a long time; if
// it's ever hit, the newest 1000 win and older rows silently drop off
// this view (still fully present in the database and exportable via
// direct SQL) — flagged here rather than left as an invisible ceiling.
const LIST_SAFETY_LIMIT = 1000

type Tab = 'overview' | 'analytics' | 'bounties' | 'applications' | 'submissions' | 'users' | 'roles' | 'credits' | 'xp' | 'leaderboard' | 'reports' | 'projects' | 'resources' | 'videos' | 'partners' | 'events' | 'news' | 'announcements' | 'homepage' | 'settings' | 'event_registrations' | 'checkin'

const TABS: [Tab, string, boolean][] = [
  // third element: true = staff-admin+ only (hidden from Moderators)
  ['submissions', 'Submissions', false],
  ['applications', 'Applications', false],
  ['users', 'Users', false], // visible to moderators too, but with fewer buttons — see AdminUsers
  ['reports', 'Reports', false], // Moderator "View reports" capability
  ['checkin', 'Check-In', false], // door-duty task — moderators run this at events too
  ['overview', 'Overview', true],
  ['analytics', 'Analytics', true],
  ['roles', 'Roles', true],
  ['credits', 'Credits', true],
  ['xp', 'XP', true],
  ['leaderboard', 'Leaderboard', true],
  ['bounties', 'Manage Bounties', true],
  ['projects', 'Ecosystem Projects', true],
  ['resources', 'Resources', true],
  ['videos', 'Videos', true],
  ['partners', 'Partners', true],
  ['events', 'Events', true],
  ['event_registrations', 'Event Registrations', true],
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
  const [bountiesError, setBountiesError] = useState<string | null>(null)
  const [applicationsError, setApplicationsError] = useState<string | null>(null)
  const [submissionsError, setSubmissionsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!isStaffAdmin && !['submissions', 'applications', 'users', 'reports', 'checkin'].includes(tab)) {
      setTab('submissions')
    }
  }, [isStaffAdmin, tab])

  async function loadBounties() {
    const { data, error } = await supabase.from('bounties').select('*').order('created_at', { ascending: false }).limit(LIST_SAFETY_LIMIT)
    if (error) { console.error('Failed to load bounties:', error); showToast(error.message); setBountiesError(error.message); return }
    setBountiesError(null)
    setBounties((data as Bounty[]) ?? [])
  }
  async function loadApplications() {
    const { data, error } = await supabase.from('applications').select('*').order('created_at', { ascending: false }).limit(LIST_SAFETY_LIMIT)
    if (error) { console.error('Failed to load applications:', error); showToast(error.message); setApplicationsError(error.message); return }
    setApplicationsError(null)
    setApplications((data as Application[]) ?? [])
  }
  async function loadSubmissions() {
    const { data, error } = await supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(LIST_SAFETY_LIMIT)
    if (error) { console.error('Failed to load submissions:', error); showToast(error.message); setSubmissionsError(error.message); return }
    setSubmissionsError(null)
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

  // --- "Manage Bounties" tab actions ------------------------------------
  // Soft delete (is_deleted = true) replaced the old hard, cascading
  // DELETE that used to wipe a bounty's submissions/applications along
  // with it — the database trigger in migration 0031 stamps
  // deleted_at/deleted_by automatically, and RLS (also 0031) hides
  // is_deleted bounties from the public bounty list/search while
  // keeping them — and every submission/application referencing them —
  // fully intact and visible to admins.
  async function softDeleteBounty(b: Bounty) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ is_deleted: true }).eq('id', b.id),
      showToast,
      {
        confirmMessage: `Are you sure you want to delete "${b.title}"? Existing submissions will be preserved.`,
        successMessage: 'Bounty deleted',
      },
    )
    if (ok) await loadBounties()
  }

  async function restoreDeletedBounty(b: Bounty) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ is_deleted: false }).eq('id', b.id),
      showToast,
      { successMessage: 'Bounty restored' },
    )
    if (ok) await loadBounties()
  }

  async function closeBounty(b: Bounty) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ is_closed: true }).eq('id', b.id),
      showToast,
      {
        confirmMessage: 'Are you sure you want to close this bounty? Users will no longer be able to submit entries.',
        successMessage: 'Bounty closed',
      },
    )
    if (ok) await loadBounties()
  }

  async function reopenBounty(b: Bounty) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ is_closed: false }).eq('id', b.id),
      showToast,
      {
        confirmMessage: 'Reopen this bounty and allow users to participate again?',
        successMessage: 'Bounty reopened',
      },
    )
    if (ok) await loadBounties()
  }

  async function toggleFeatured(b: Bounty) {
    const ok = await runAdminAction(
      () => supabase.from('bounties').update({ is_featured: !b.is_featured }).eq('id', b.id),
      showToast,
      { successMessage: !b.is_featured ? 'Bounty featured' : 'Bounty unfeatured' },
    )
    if (ok) await loadBounties()
  }

  async function createBounty(draft: BountyDraft): Promise<boolean> {
    // Admin-created bounties start as a draft (status: 'pending', the
    // same non-public state a project's own host-a-bounty submission
    // starts in) — "Activate" is a separate, deliberate action so a
    // bounty is never accidentally live the moment it's created.
    const { error } = await supabase.from('bounties').insert({ ...draft, status: 'pending' })
    if (error) { logError('[AdminDashboard] create bounty failed:', error); showToast(error.message); return false }
    showToast('Bounty created as draft')
    await loadBounties()
    return true
  }

  async function updateBounty(id: string, draft: BountyDraft): Promise<boolean> {
    const { error } = await supabase.from('bounties').update(draft).eq('id', id)
    if (error) { logError('[AdminDashboard] update bounty failed:', error); showToast(error.message); return false }
    showToast('Bounty updated')
    await loadBounties()
    return true
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

  const draftBounties = bounties.filter((b) => !b.is_deleted && b.status !== 'approved')

  // Counts submissions/applications per bounty from the lists already
  // loaded above — the "Manage Bounties" tab needs a per-bounty count
  // for its Actions column, and both lists are already fully in memory
  // for the Submissions/Applications tabs, so this reuses them instead
  // of issuing a separate count query per bounty (or a GROUP BY RPC).
  const submissionCounts = useMemo(() => {
    const c: Record<string, number> = {}
    submissions.forEach((s) => { c[s.bounty_id] = (c[s.bounty_id] ?? 0) + 1 })
    return c
  }, [submissions])
  const applicationCounts = useMemo(() => {
    const c: Record<string, number> = {}
    applications.forEach((a) => { c[a.bounty_id] = (c[a.bounty_id] ?? 0) + 1 })
    return c
  }, [applications])

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
              {key === 'bounties' && draftBounties.length > 0 && ` (${draftBounties.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-white/40 text-sm">Loading…</div>
        ) : (
        <Suspense fallback={<div className="text-white/40 text-sm">Loading…</div>}>
        {tab === 'overview' ? (
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
        ) : tab === 'checkin' ? (
          <AdminCheckIn showToast={showToast} />
        ) : tab === 'event_registrations' ? (
          <AdminEventRegistrations showToast={showToast} />
        ) : tab === 'settings' ? (
          <AdminSettings showToast={showToast} />
        ) : tab === 'announcements' ? (
          <AdminAnnouncements showToast={showToast} />
        ) : tab === 'homepage' ? (
          <AdminHomepage showToast={showToast} />
        ) : tab === 'applications' ? (
          <ApplicationsList items={applications} loadError={applicationsError} onApprove={(a) => updateApplicationStatus(a, 'approved')} onReject={(a) => updateApplicationStatus(a, 'rejected')} />
        ) : tab === 'submissions' ? (
          <SubmissionsList items={submissions} loadError={submissionsError} onApprove={(s) => updateSubmissionStatus(s, 'approved')} onReject={(s) => updateSubmissionStatus(s, 'rejected')} onExport={exportSubmissionsCsv} onMarkWinner={markSubmissionWinner} />
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
          <AdminBounties
            bounties={bounties}
            loadError={bountiesError}
            submissionCounts={submissionCounts}
            applicationCounts={applicationCounts}
            showToast={showToast}
            onCreate={createBounty}
            onUpdate={updateBounty}
            onApprove={(b) => updateStatus(b.id, 'approved')}
            onReject={(b) => updateStatus(b.id, 'rejected')}
            onRestoreToDraft={(b) => updateStatus(b.id, 'pending')}
            onClose={closeBounty}
            onReopen={reopenBounty}
            onSoftDelete={softDeleteBounty}
            onRestoreDeleted={restoreDeletedBounty}
            onToggleFeatured={toggleFeatured}
          />
        )}
        </Suspense>
        )}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-panel border border-white/15 px-6 py-3 rounded-full text-sm z-50">{toast}</div>}
    </div>
  )
}

function ApplicationsList({ items, loadError, onApprove, onReject }: { items: Application[]; loadError?: string | null; onApprove: (a: Application) => void; onReject: (a: Application) => void }) {
  if (loadError) return <div className="text-rose-300 text-sm py-10 text-center">Couldn't load applications: {loadError}</div>
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
  loadError,
  onApprove,
  onReject,
  onExport,
  onMarkWinner,
}: {
  items: Submission[]
  loadError?: string | null
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
      {loadError ? (
        <div className="text-rose-300 text-sm py-10 text-center">Couldn't load submissions: {loadError}</div>
      ) : items.length === 0 ? (
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
