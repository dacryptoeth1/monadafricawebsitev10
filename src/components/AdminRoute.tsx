import { useAuth } from '../context/AuthContext'
import AdminLogin from '../pages/admin/AdminLogin'
import AdminDashboard from '../pages/admin/AdminDashboard'

export default function AdminRoute() {
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
  }

  return <AdminDashboard />
}
