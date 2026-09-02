import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import MonadMark from './components/MonadMark'
import ScrollToTop from './components/ScrollToTop'

// Route-level code splitting: keeps the initial bundle small by only
// loading each page's JS when that route is actually visited. This
// matters most for Signup/Profile (pull in the country-state-city
// dataset) and Admin (pulls in the whole admin dashboard) — neither
// should weigh down the homepage's first load.
const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Explore = lazy(() => import('./pages/Explore'))
const Builders = lazy(() => import('./pages/Builders'))
const Community = lazy(() => import('./pages/Community'))
const Bounties = lazy(() => import('./pages/Bounties'))
const Events = lazy(() => import('./pages/Events'))
const HostBounty = lazy(() => import('./pages/HostBounty'))
const BeginnerHub = lazy(() => import('./pages/BeginnerHub'))
const Ecosystem = lazy(() => import('./pages/Ecosystem'))
const Partners = lazy(() => import('./pages/Partners'))
const Team = lazy(() => import('./pages/Team'))
const Contact = lazy(() => import('./pages/Contact'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ProjectBountyDashboard = lazy(() => import('./pages/ProjectBountyDashboard'))
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
        <ScrollToTop />
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
                      <Route path="/explore" element={<Explore />} />
                      <Route path="/builders" element={<Builders />} />
                      <Route path="/community" element={<Community />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      {/* /opportunities is the canonical route (matches the
                          main nav label) — /bounties still works and just
                          redirects, so no existing link/bookmark breaks. */}
                      <Route path="/opportunities" element={<Bounties />} />
                      <Route path="/bounties" element={<Navigate to="/opportunities" replace />} />
                      <Route path="/events" element={<Events />} />
                      <Route
                        path="/host-bounty"
                        element={
                          <RequireAuth>
                            <HostBounty />
                          </RequireAuth>
                        }
                      />
                      {/* /beginners is the canonical route (matches the main
                          nav label "Beginners Hub") — /beginner-hub still
                          works and just redirects. */}
                      <Route path="/beginners" element={<BeginnerHub />} />
                      <Route path="/beginner-hub" element={<Navigate to="/beginners" replace />} />
                      <Route path="/ecosystem" element={<Ecosystem />} />
                      <Route path="/partners" element={<Partners />} />
                      <Route path="/team" element={<Team />} />
                      {/* /partner used to be a separate, signed-in, 3-step
                          application wizard with its own "Contact Lead BD" /
                          "Meet the BD Team" step before the form — retired
                          in favor of the single direct proposal form on
                          /partners itself (no intermediate page). Redirected,
                          not just removed, so no old link 404s. */}
                      <Route path="/partner" element={<Navigate to="/partners#partner-form" replace />} />
                      <Route
                        path="/my-bounty"
                        element={
                          <RequireAuth>
                            <ProjectBountyDashboard />
                          </RequireAuth>
                        }
                      />
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
