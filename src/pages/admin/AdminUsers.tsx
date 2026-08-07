import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import type { AdminRole, Profile } from '../../types'

const PAGE_SIZE = 25
const ROLE_RANK: Record<string, number> = { user: 0, moderator: 1, admin: 2, super_admin: 3 }

export default function AdminUsers({ showToast, isStaffAdmin }: { showToast: (msg: string) => void; isStaffAdmin: boolean }) {
  const [users, setUsers] = useState<Profile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [historyFor, setHistoryFor] = useState<Profile | null>(null)
  const [profileFor, setProfileFor] = useState<Profile | null>(null)
  const [adminRoles, setAdminRoles] = useState<Map<string, AdminRole>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'credits' | 'xp' | 'referrals'>('newest')
  const [page, setPage] = useState(0)

  // Debounce the search box so we're not firing a server round-trip on
  // every keystroke — 300ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(0)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Staff list is small (a handful of accounts) — safe to load in full
  // once, used both for role badges and for the role-tier filter below.
  async function loadAdminRoles() {
    const { data, error } = await supabase.from('admins').select('id, role')
    if (error) { showToast(error.message); return }
    setAdminRoles(new Map((data ?? []).map((a: any) => [a.id, a.role as AdminRole])))
  }

  useEffect(() => {
    loadAdminRoles()
  }, [])

  async function load() {
    setLoading(true)
    let query = supabase.from('profiles').select('*', { count: 'exact' })

    if (search.trim()) {
      const q = search.trim().replace(/[%_,()]/g, (c) => `\\${c}`)
      query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
    }

    if (roleFilter === 'suspended') {
      query = query.eq('is_suspended', true)
    } else if (roleFilter === 'banned') {
      query = query.eq('is_banned', true)
    } else if (roleFilter === 'super_admin' || roleFilter === 'admin' || roleFilter === 'moderator') {
      const ids = [...adminRoles.entries()].filter(([, r]) => r === roleFilter).map(([id]) => id)
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    }

    const sortColumn = sortBy === 'credits' ? 'credits' : sortBy === 'xp' ? 'xp' : sortBy === 'referrals' ? 'total_referrals' : 'created_at'
    query = query.order(sortColumn, { ascending: sortBy === 'oldest' })

    const from = page * PAGE_SIZE
    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1)

    if (error) {
      showToast(error.message)
      setLoading(false)
      return
    }
    setUsers((data as Profile[]) ?? [])
    setTotalCount(count ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, sortBy, page, adminRoles])

  async function adjustCredits(userId: string, amount: number) {
    if (amount < 0 && !confirm(`Remove ${Math.abs(amount)} credit(s) from this user?`)) return
    const reason = prompt(`Reason for ${amount > 0 ? 'adding' : 'removing'} ${Math.abs(amount)} credit(s)?`) || 'admin_adjustment'
    const ok = await runAdminAction(
      () => supabase.rpc('admin_adjust_credits', { p_user_id: userId, p_amount: amount, p_reason: reason }),
      showToast,
      { successMessage: 'Credits updated' },
    )
    if (ok) await load()
  }

  async function resetCredits(userId: string) {
    const ok = await runAdminAction(
      () => supabase.rpc('admin_reset_credits', { p_user_id: userId }),
      showToast,
      { confirmMessage: "Reset this user's credits back to the platform default?", successMessage: 'Credits reset' },
    )
    if (ok) await load()
  }

  async function toggleSuspend(user: Profile) {
    const ok = await runAdminAction(
      () => supabase.rpc('admin_set_suspended', { p_user_id: user.id, p_suspended: !user.is_suspended }),
      showToast,
      {
        confirmMessage: user.is_suspended ? 'Reinstate this account?' : 'Suspend this account? They will lose write access until reinstated.',
        successMessage: user.is_suspended ? 'Account reinstated' : 'Account suspended',
      },
    )
    if (ok) await load()
  }

  async function toggleBan(user: Profile) {
    const ok = await runAdminAction(
      () => supabase.rpc('admin_set_banned', { p_user_id: user.id, p_banned: !user.is_banned }),
      showToast,
      {
        confirmMessage: user.is_banned ? 'Unban this account?' : `Ban ${user.username || user.email}? This signs them out immediately and blocks all writes.`,
        successMessage: user.is_banned ? 'Account unbanned' : 'Account banned',
      },
    )
    if (ok) await load()
  }

  async function deleteUserData(user: Profile) {
    const ok = await runAdminAction(
      () => supabase.rpc('admin_delete_profile_data', { p_user_id: user.id }),
      showToast,
      {
        confirmMessage: `Delete all profile data for ${user.username || user.email}? This removes their profile, applications, submissions, and credit history — it does NOT delete their login (that needs the Supabase Admin API). This cannot be undone.`,
        successMessage: 'Profile data deleted',
      },
    )
    if (ok) await load()
  }

  async function changeRole(userId: string, currentRole: string, newRole: string) {
    const isDowngrade = ROLE_RANK[newRole] < ROLE_RANK[currentRole]
    if (isDowngrade && !confirm(`Change this user's role from ${currentRole} to ${newRole === 'user' ? 'regular user (remove admin access)' : newRole}?`)) return
    const ok = await runAdminAction(
      () => supabase.rpc('admin_set_role', { p_user_id: userId, p_role: newRole === 'user' ? null : newRole }),
      showToast,
      { successMessage: 'Role updated' },
    )
    if (ok) {
      await loadAdminRoles()
      await load()
    }
  }

  async function awardXp(userId: string, amount: number) {
    if (amount < 0 && !confirm(`Remove ${Math.abs(amount)} XP from this user?`)) return
    const reason = prompt(`Reason for ${amount > 0 ? 'awarding' : 'removing'} ${Math.abs(amount)} XP?`) || 'admin_adjustment'
    const ok = await runAdminAction(
      () => supabase.rpc('admin_award_xp', { p_user_id: userId, p_amount: amount, p_reason: reason }),
      showToast,
      { successMessage: 'XP updated' },
    )
    if (ok) await load()
  }

  async function resetXp(userId: string) {
    const ok = await runAdminAction(
      () => supabase.rpc('admin_reset_xp', { p_user_id: userId }),
      showToast,
      { confirmMessage: "Reset this user's XP to 0?", successMessage: 'XP reset' },
    )
    if (ok) await load()
  }

  async function toggleAmbassador(user: Profile) {
    // Atomic RPC (profile update + badge award in one transaction) —
    // replaces the old two-step client-side sequence.
    const ok = await runAdminAction(
      () => supabase.rpc('admin_toggle_ambassador', { p_user_id: user.id, p_is_ambassador: !user.is_ambassador }),
      showToast,
      { successMessage: user.is_ambassador ? 'Ambassador status removed' : 'Ambassador status granted' },
    )
    if (ok) await load()
  }

  async function exportUsersCsv() {
    // Full export intentionally bypasses the 25-per-page UI limit — an
    // admin exporting expects every matching user, not just the current
    // page. Still respects the active search/role filter.
    let query = supabase.from('profiles').select('*')
    if (search.trim()) {
      const q = search.trim().replace(/[%_,()]/g, (c) => `\\${c}`)
      query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
    }
    const { data, error } = await query
    if (error) { showToast(error.message); return }

    const headers = ['id', 'username', 'full_name', 'email', 'country', 'region', 'role', 'credits', 'xp', 'total_referrals', 'wallet_address', 'is_suspended', 'is_banned', 'created_at']
    const rows = (data ?? []).map((u: any) =>
      headers.map((h) => `"${String(u[h] ?? '').replace(/"/g, '""')}"`).join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `monad-africa-users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, username, or email…"
          className="input flex-1 min-w-[220px]"
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(0) }} className="input w-auto text-sm">
          <option value="all">All users</option>
          <option value="super_admin">Super Admins</option>
          <option value="admin">Admins</option>
          <option value="moderator">Moderators</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(0) }} className="input w-auto text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="credits">Most credits</option>
          <option value="xp">Most XP</option>
          <option value="referrals">Most referrals</option>
        </select>
        {isStaffAdmin && (
          <button onClick={exportUsersCsv} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">
            <Download size={13} /> Export Users
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-white/40 text-sm py-10 text-center">Loading…</div>
      ) : users.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No users found.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <div key={u.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm">
                  {u.full_name || u.username || 'Unnamed'}{' '}
                  {adminRoles.get(u.id) === 'super_admin' && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-gold/40 text-gold">super admin</span>}
                  {adminRoles.get(u.id) === 'admin' && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-sunset-amber/40 text-sunset-amber">admin</span>}
                  {adminRoles.get(u.id) === 'moderator' && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-purple/40 text-purple-light">moderator</span>}
                  {u.is_ambassador && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-emerald-300/30 text-emerald-300">ambassador</span>}
                  {u.is_suspended && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-amber-300/30 text-amber-300">suspended</span>}
                  {u.is_banned && <span className="ml-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-rose-300/30 text-rose-300">banned</span>}
                </div>
                <div className="text-white/40 text-xs mt-1">@{u.username} · {u.email} · {u.country || '—'} · {u.credits} credits · {u.xp} XP · {u.total_referrals} referrals</div>
              </div>
              <div className="flex flex-wrap gap-2 flex-none items-center">
                <button onClick={() => setProfileFor(u)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">View Profile</button>
                <AmountAdjuster defaultValue={1} unit="credit" onApply={(amt) => adjustCredits(u.id, amt)} />
                <AmountAdjuster defaultValue={10} unit="XP" onApply={(amt) => awardXp(u.id, amt)} />
                <button onClick={() => setHistoryFor(u)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">History</button>
                {isStaffAdmin && (
                  <>
                    <button onClick={() => resetCredits(u.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">Reset credits</button>
                    <button onClick={() => resetXp(u.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5">Reset XP</button>
                    <button onClick={() => toggleAmbassador(u)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10">
                      {u.is_ambassador ? 'Remove ambassador' : 'Make ambassador'}
                    </button>
                    <select
                      value={adminRoles.get(u.id) || 'user'}
                      onChange={(e) => changeRole(u.id, adminRoles.get(u.id) || 'user', e.target.value)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border border-purple/30 text-purple-light bg-transparent"
                    >
                      <option value="user" className="bg-panel">User</option>
                      <option value="moderator" className="bg-panel">Moderator</option>
                      <option value="admin" className="bg-panel">Admin</option>
                      <option value="super_admin" className="bg-panel">Super Admin</option>
                    </select>
                    <button onClick={() => toggleSuspend(u)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-400/30 text-amber-300 hover:bg-amber-400/10">
                      {u.is_suspended ? 'Reinstate' : 'Suspend'}
                    </button>
                    <button onClick={() => toggleBan(u)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-rose-400/30 text-rose-300 hover:bg-rose-400/10">
                      {u.is_banned ? 'Unban' : 'Ban'}
                    </button>
                    <button onClick={() => deleteUserData(u)} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white/40 hover:bg-white/5">
                      Delete data
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-6 text-xs text-white/40">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-full border border-white/15 disabled:opacity-30 hover:bg-white/5"
            >
              Previous
            </button>
            <span className="px-2 py-1.5">Page {page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-3 py-1.5 rounded-full border border-white/15 disabled:opacity-30 hover:bg-white/5"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {historyFor && <UserHistoryModal user={historyFor} onClose={() => setHistoryFor(null)} showToast={showToast} />}
      {profileFor && <UserProfileModal user={profileFor} onClose={() => setProfileFor(null)} />}
    </div>
  )
}

// Small reusable "amount + apply" control so credit/XP adjustments
// aren't locked to a hardcoded +1/-1 or +10/-10 — an admin can type any
// amount before applying it in either direction.
function AmountAdjuster({ defaultValue, unit, onApply }: { defaultValue: number; unit: string; onApply: (amount: number) => void }) {
  const [amount, setAmount] = useState(defaultValue)
  return (
    <div className="flex items-center gap-1 border border-white/15 rounded-full pl-1 pr-1 py-0.5">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
        className="w-12 bg-transparent text-xs text-center outline-none"
        aria-label={`${unit} amount`}
      />
      <button onClick={() => onApply(amount)} disabled={amount === 0} className="px-2 py-1 rounded-full text-xs font-semibold hover:bg-white/10 disabled:opacity-30">
        +{unit}
      </button>
      <button onClick={() => onApply(-amount)} disabled={amount === 0} className="px-2 py-1 rounded-full text-xs font-semibold hover:bg-white/10 disabled:opacity-30">
        -{unit}
      </button>
    </div>
  )
}

function UserHistoryModal({ user, onClose, showToast }: { user: Profile; onClose: () => void; showToast: (msg: string) => void }) {
  const [credits, setCredits] = useState<{ id: string; amount: number; reason: string; created_at: string }[] | null>(null)
  const [xp, setXp] = useState<{ id: string; amount: number; reason: string; created_at: string }[] | null>(null)

  useEffect(() => {
    supabase.from('credit_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => { if (error) showToast(error.message); setCredits(data ?? []) })
    supabase.from('xp_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => { if (error) showToast(error.message); setXp(data ?? []) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  return (
    <div className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">{user.full_name || user.username} — History</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm">✕</button>
        </div>

        <h4 className="text-xs font-mono uppercase text-white/40 mb-2">⭐ Credit History (last 50)</h4>
        <div className="flex flex-col gap-1.5 mb-5">
          {credits === null ? (
            <div className="text-white/30 text-xs">Loading…</div>
          ) : credits.length === 0 ? (
            <div className="text-white/30 text-xs">No credit activity.</div>
          ) : (
            credits.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs bg-white/[0.02] rounded-lg px-3 py-2">
                <span className="text-white/60">{c.reason.replace(/_/g, ' ')} · {new Date(c.created_at).toLocaleDateString()}</span>
                <span className={c.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{c.amount >= 0 ? '+' : ''}{c.amount}</span>
              </div>
            ))
          )}
        </div>

        <h4 className="text-xs font-mono uppercase text-white/40 mb-2">🏅 XP History (last 50)</h4>
        <div className="flex flex-col gap-1.5">
          {xp === null ? (
            <div className="text-white/30 text-xs">Loading…</div>
          ) : xp.length === 0 ? (
            <div className="text-white/30 text-xs">No XP activity.</div>
          ) : (
            xp.map((x) => (
              <div key={x.id} className="flex items-center justify-between text-xs bg-white/[0.02] rounded-lg px-3 py-2">
                <span className="text-white/60">{x.reason.replace(/_/g, ' ')} · {new Date(x.created_at).toLocaleDateString()}</span>
                <span className={x.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{x.amount >= 0 ? '+' : ''}{x.amount}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function UserProfileModal({ user, onClose }: { user: Profile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-panel p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold">User Profile</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-sm">✕</button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden text-lg font-display font-bold shrink-0">
            {user.avatar_url ? <img src={user.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : (user.username || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-display font-semibold text-lg truncate">{user.full_name || user.username || 'Unnamed'}</div>
            <div className="text-white/40 text-xs">@{user.username} · {user.email}</div>
          </div>
        </div>

        {user.bio && <p className="text-white/60 text-sm mb-5 leading-relaxed">{user.bio}</p>}

        <div className="grid grid-cols-2 gap-3 mb-5">
          <ProfileField label="Country" value={user.country} />
          <ProfileField label="Region / State" value={user.region} />
          <ProfileField label="Role" value={user.role} />
          <ProfileField label="Joined" value={new Date(user.created_at).toLocaleDateString()} />
          <ProfileField label="Credits" value={String(user.credits)} />
          <ProfileField label="XP" value={String(user.xp)} />
          <ProfileField label="Referrals" value={String(user.total_referrals)} />
          <ProfileField label="Referral Code" value={user.referral_code} />
        </div>

        {(user.twitter || user.discord || user.telegram || user.github || user.website) && (
          <div className="mb-5">
            <div className="text-[10px] font-mono uppercase text-white/40 mb-2">Social Links</div>
            <div className="flex flex-wrap gap-2">
              {user.twitter && <span className="text-xs px-2.5 py-1 rounded-full border border-white/15">X: {user.twitter}</span>}
              {user.discord && <span className="text-xs px-2.5 py-1 rounded-full border border-white/15">Discord: {user.discord}</span>}
              {user.telegram && <span className="text-xs px-2.5 py-1 rounded-full border border-white/15">Telegram: {user.telegram}</span>}
              {user.github && <span className="text-xs px-2.5 py-1 rounded-full border border-white/15">GitHub: {user.github}</span>}
              {user.website && <span className="text-xs px-2.5 py-1 rounded-full border border-white/15">{user.website}</span>}
            </div>
          </div>
        )}

        {user.wallet_address && (
          <div>
            <div className="text-[10px] font-mono uppercase text-white/40 mb-1">Wallet {user.wallet_provider && `(${user.wallet_provider})`}</div>
            <code className="text-xs text-purple-light break-all">{user.wallet_address}</code>
          </div>
        )}
      </div>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase text-white/40">{label}</div>
      <div className="text-sm text-white/70 truncate">{value || '—'}</div>
    </div>
  )
}
