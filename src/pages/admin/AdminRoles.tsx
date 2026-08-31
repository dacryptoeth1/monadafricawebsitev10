import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'

interface StaffRow extends Profile {
  role_tier: 'super_admin' | 'admin' | 'moderator'
}

const ROLE_RANK: Record<string, number> = { user: 0, moderator: 1, admin: 2, super_admin: 3 }

export default function AdminRoles({ showToast }: { showToast: (msg: string) => void }) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  async function load() {
    const { data: admins, error: adminsError } = await supabase.from('admins').select('id, role')
    if (adminsError) { console.error('Failed to load admins:', adminsError); showToast(adminsError.message); setLoadError(adminsError.message); setLoading(false); return }
    if (!admins || admins.length === 0) {
      setLoadError(null)
      setStaff([])
      setLoading(false)
      return
    }
    const ids = admins.map((a: any) => a.id)
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', ids)
    if (profilesError) { console.error('Failed to load staff profiles:', profilesError); showToast(profilesError.message); setLoadError(profilesError.message); setLoading(false); return }
    setLoadError(null)
    const roleMap = new Map(admins.map((a: any) => [a.id, a.role]))
    const rows = ((profiles as Profile[]) ?? [])
      .map((p) => ({ ...p, role_tier: roleMap.get(p.id) }))
      .sort((a, b) => {
        const order = { super_admin: 0, admin: 1, moderator: 2 }
        return (order as any)[a.role_tier] - (order as any)[b.role_tier]
      })
    setStaff(rows as StaffRow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function changeRole(userId: string, currentRole: string, role: string) {
    if (ROLE_RANK[role] < ROLE_RANK[currentRole]) {
      const label = role === 'user' ? 'regular user (remove admin access entirely)' : role
      if (!confirm(`Change this staff member's role from ${currentRole} to ${label}?`)) return
    }
    const { error } = await supabase.rpc('admin_set_role', { p_user_id: userId, p_role: role === 'user' ? null : role })
    if (error) { showToast(error.message); return }
    await load()
    showToast('Role updated')
  }

  if (loading) return <div className="text-white/40 text-sm">Loading…</div>

  const badgeStyle: Record<string, string> = {
    super_admin: 'text-gold border-gold/40',
    admin: 'text-sunset-amber border-sunset-amber/40',
    moderator: 'text-purple-light border-purple/40',
  }

  return (
    <div>
      <p className="text-white/40 text-xs mb-6 leading-relaxed">
        Everyone with admin-panel access, grouped by tier. Promote/demote here or from the
        Users tab — both update the same underlying role.
      </p>
      {loadError ? (
        <div className="text-rose-300 text-sm py-10 text-center">Couldn't load staff members: {loadError}</div>
      ) : staff.length === 0 ? (
        <div className="text-white/40 text-sm py-10 text-center">No staff members yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {staff.map((u) => (
            <div key={u.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display font-semibold text-sm flex items-center gap-2">
                  {u.full_name || u.username || 'Unnamed'}
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${badgeStyle[u.role_tier]}`}>
                    {u.role_tier.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-white/40 text-xs mt-1">@{u.username} · {u.email}</div>
              </div>
              <select
                value={u.role_tier}
                onChange={(e) => changeRole(u.id, u.role_tier, e.target.value)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-purple/30 text-purple-light bg-transparent"
              >
                <option value="user" className="bg-panel text-rose-300">Remove access (User)</option>
                <option value="moderator" className="bg-panel">Moderator</option>
                <option value="admin" className="bg-panel">Admin</option>
                <option value="super_admin" className="bg-panel">Super Admin</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
