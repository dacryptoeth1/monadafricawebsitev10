import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import MonadMark from './components/MonadMark'

// Route-level code splitting: keeps the initial bundle small by only
// loading each page's JS when that route is actually visited. This
// matters most for Signup/Profile (pull in the country-state-city
// dataset) and Admin (pulls in the whole admin dashboard) — neither
// should weigh down the homepage's first load.
const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Community = lazy(() => import('./pages/Community'))
const Bounties = lazy(() => import('./pages/Bounties'))
const Events = lazy(() => import('./pages/Events'))
const HostBounty = lazy(() => import('./pages/HostBounty'))
const BeginnerHub = lazy(() => import('./pages/BeginnerHub'))
const Ecosystem = lazy(() => import('./pages/Ecosystem'))
const Partners = lazy(() => import('./pages/Partners'))
const Contact = lazy(() => import('./pages/Contact'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Settings = lazy(() => import('./pages/Settings'))
const ActivityHistory = lazy(() => import('./pages/ActivityHistory'))
const AdminRoute = lazy(() => import('./components/AdminRoute'))

function PageFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-ink">
      <MonadMark size={44} className="animate-pulse" />
      <div className="text-white/30 text-xs font-mono uppercase tracking-wider">Loading…</div>
    </div>
  )
}

export default function App() {
  return (
    // reducedMotion="user" makes every framer-motion animation in the
    // app (Reveal's scroll-in, dropdown/modal enter-exit, card hover
    // lift, ...) automatically drop its transform (x/y/scale/rotate)
    // component for anyone with the OS-level "reduce motion"
    // accessibility setting on, while still cross-fading opacity — one
    // root-level flag instead of auditing/guarding every individual
    // motion.* usage across the app.
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* /admin is intentionally outside the public Layout — no nav
                link anywhere points to it. */}
            <Route path="/admin" element={<AdminRoute />} />

            <Route
              path="*"
              element={
                <Layout>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/community" element={<Community />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      <Route path="/bounties" element={<Bounties />} />
                      <Route path="/events" element={<Events />} />
                      <Route path="/host-bounty" element={<HostBounty />} />
                      <Route path="/beginner-hub" element={<BeginnerHub />} />
                      <Route path="/ecosystem" element={<Ecosystem />} />
                      <Route path="/partners" element={<Partners />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
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
                      <Route
                        path="/settings"
                        element={
                          <RequireAuth>
                            <Settings />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/activity"
                        element={
                          <RequireAuth>
                            <ActivityHistory />
                          </RequireAuth>
                        }
                      />
                    </Routes>
                  </Suspense>
                </Layout>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </MotionConfig>
  )
}
