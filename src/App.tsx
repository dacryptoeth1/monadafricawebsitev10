import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Community from './pages/Community'
import Bounties from './pages/Bounties'
import HostBounty from './pages/HostBounty'
import BeginnerHub from './pages/BeginnerHub'
import Ecosystem from './pages/Ecosystem'
import Partners from './pages/Partners'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import RequireAuth from './components/RequireAuth'
import AdminRoute from './components/AdminRoute'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* /admin is intentionally outside the public Layout — no nav link
            anywhere points to it. */}
        <Route path="/admin" element={<AdminRoute />} />

        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/community" element={<Community />} />
                <Route path="/bounties" element={<Bounties />} />
                <Route path="/host-bounty" element={<HostBounty />} />
                <Route path="/beginner-hub" element={<BeginnerHub />} />
                <Route path="/ecosystem" element={<Ecosystem />} />
                <Route path="/partners" element={<Partners />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  }
                />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
