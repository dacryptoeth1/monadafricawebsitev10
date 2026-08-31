<<<<<<< HEAD
=======
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
>>>>>>> fix/password-reset-otp-admin-api
import { useAuth } from '../context/AuthContext'
import AdminLogin from '../pages/admin/AdminLogin'
import AdminDashboard from '../pages/admin/AdminDashboard'

export default function AdminRoute() {
<<<<<<< HEAD
  const { session, loading, isAdmin } = useAuth()

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white/40 text-sm bg-ink">Loading…</div>
  }

  if (!session) return <AdminLogin />

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6 bg-ink">
        <div>
          <h1 className="font-display font-semibold text-xl mb-2">Not authorized</h1>
          <p className="text-white/50 text-sm max-w-sm">
            This account is signed in but isn't on the admin allowlist. Add its user ID to the{' '}
            <code className="text-purple-light">admins</code> table in Supabase to grant access.
          </p>
        </div>
      </div>
    )
=======
  // Any staff tier (Moderator, Admin, Super Admin) reaches the
  // dashboard — AdminDashboard itself hides/disables tabs and actions
  // based on adminRole, and the database RPCs behind those actions
  // independently enforce the same tiers, so this isn't just a
  // UI-level restriction.
  const { session, loading, isAdmin, refreshProfile } = useAuth()
  const [rechecking, setRechecking] = useState(true)

  // Re-verify the role fresh from Supabase every time this route
  // mounts, rather than trusting whatever was cached at initial login.
  // This is what makes a role change (e.g. an admin promoting this
  // account in another tab, or via SQL) take effect immediately on the
  // next visit to /admin, without requiring a full logout/login.
  useEffect(() => {
    if (!session) {
      setRechecking(false)
      return
    }
    refreshProfile().finally(() => setRechecking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id])

  if (loading || rechecking) {
    return <div className="min-h-screen flex items-center justify-center text-white/40 text-sm bg-ink">Loading…</div>
  }

  // Not signed in at all — send to login rather than the homepage, so
  // there's still a path in for staff who haven't authenticated yet.
  if (!session) return <AdminLogin />

  // Signed in but not on the admin allowlist — a "normal user."
  // Redirected straight back to the homepage, no explanatory page.
  if (!isAdmin) {
    return <Navigate to="/" replace />
>>>>>>> fix/password-reset-otp-admin-api
  }

  return <AdminDashboard />
}
