<<<<<<< HEAD
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'
=======
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { AdminRole, Profile } from '../types'
>>>>>>> fix/password-reset-otp-admin-api

interface SignUpFields {
  full_name: string
  username: string
  country: string
  role: string
  referredByCode?: string
}

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
<<<<<<< HEAD
=======
  adminRole: AdminRole | null
  isSuperAdmin: boolean
  banned: boolean
>>>>>>> fix/password-reset-otp-admin-api
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fields: SignUpFields) => Promise<void>
  signOut: () => Promise<void>
  resetPasswordRequest: (email: string) => Promise<void>
<<<<<<< HEAD
  updatePassword: (newPassword: string) => Promise<void>
  refreshProfile: () => Promise<void>
=======
  verifyPasswordResetOtp: (email: string, token: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  refreshProfile: () => Promise<void>
  resendVerificationEmail: (email: string) => Promise<void>
>>>>>>> fix/password-reset-otp-admin-api
}

const AuthContext = createContext<AuthValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
<<<<<<< HEAD
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
=======
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null)
  const [banned, setBanned] = useState(false)
  const [loading, setLoading] = useState(true)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
>>>>>>> fix/password-reset-otp-admin-api

  async function loadProfileAndAdmin(s: Session | null) {
    if (!s) {
      setProfile(null)
<<<<<<< HEAD
      setIsAdmin(false)
      setLoading(false)
      return
    }
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('admins').select('id').eq('id', s.user.id).maybeSingle(),
    ])
    setProfile((p as Profile) ?? null)
    setIsAdmin(!!a)
    setLoading(false)
  }

  useEffect(() => {
=======
      setAdminRole(null)
      setBanned(false)
      setLoading(false)
      return
    }
    // Everything below is wrapped in try/finally: this function is
    // called (unawaited) from onAuthStateChange right after every
    // login. Previously, if any query here threw for any reason — a
    // network blip, an RLS issue, anything — the function would throw
    // before ever reaching setLoading(false), leaving `loading` stuck
    // at true forever. RequireAuth checks `loading` before deciding to
    // render or redirect, so a stuck `loading` made gated routes show
    // "Loading…" indefinitely right after a successful sign-in —
    // indistinguishable from a broken/looping login. The session
    // itself is still valid even if profile/admin data fails to load,
    // so errors here are logged and the rest of the app is allowed to
    // proceed rather than hang.
    try {
      const [{ data: p, error: profileErr }, { data: a, error: adminErr }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
        supabase.from('admins').select('role').eq('id', s.user.id).maybeSingle(),
      ])
      if (profileErr) console.error('[AuthContext] Failed to load profile:', profileErr)
      if (adminErr) console.error('[AuthContext] Failed to load admin role:', adminErr)

      let prof = (p as Profile) ?? null
      // Safety net: the signup trigger should always create a profile row,
      // but if it somehow didn't (or this is a pre-existing account from
      // before the trigger existed), self-heal by creating one now rather
      // than leaving credits/XP/etc. blank forever.
      if (!prof) {
        const { data: healed, error: healErr } = await supabase.rpc('ensure_profile')
        if (healErr) console.error('[AuthContext] ensure_profile failed:', healErr)
        prof = (healed as Profile) ?? null
      }
      // Credits self-heal: the column is meant to be NOT NULL DEFAULT 3,
      // but if this row somehow has a null/undefined credits value (e.g.
      // predates that constraint), default it to 3 in the UI immediately
      // and persist the fix back to Supabase — never leave the Credits
      // card blank, and never silently rely on a client-only default.
      if (prof && (prof.credits === null || prof.credits === undefined)) {
        prof = { ...prof, credits: 3 }
        supabase.from('profiles').update({ credits: 3 }).eq('id', prof.id).then(() => {})
      }
      // Same self-heal for XP — never blank, NULL, or undefined either.
      if (prof && (prof.xp === null || prof.xp === undefined)) {
        prof = { ...prof, xp: 0 }
        supabase.from('profiles').update({ xp: 0 }).eq('id', prof.id).then(() => {})
      }
      setProfile(prof)
      setAdminRole((a?.role as AdminRole) ?? null)
      // Banned users are signed out immediately — is_banned already blocks
      // writes at the RLS layer, this just also boots them from the
      // session so they can't keep browsing as if nothing happened.
      if (prof?.is_banned) {
        setBanned(true)
        await supabase.auth.signOut()
      } else {
        setBanned(false)
      }
    } catch (err) {
      console.error('[AuthContext] loadProfileAndAdmin failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // getSession() reads the persisted session from storage (supabase-js
    // persists to localStorage by default) — this is what makes a login
    // survive a page refresh.
>>>>>>> fix/password-reset-otp-admin-api
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadProfileAndAdmin(data.session)
    })
<<<<<<< HEAD
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
=======
    // supabase-js v2 also fires this listener immediately on subscribe,
    // with event "INITIAL_SESSION" and that exact same session — so
    // without the guard below, every single page load ran
    // loadProfileAndAdmin() (a profile query + an admin-role query)
    // twice: once from getSession() above, once again from this
    // redundant initial callback. Every later real change (SIGNED_IN,
    // SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, ...) still goes
    // through normally — only that one guaranteed-duplicate initial
    // event is skipped, so this can't affect login/logout/refresh
    // behavior, only remove a wasted repeat of the same fetch.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') return
>>>>>>> fix/password-reset-otp-admin-api
      setSession(s)
      loadProfileAndAdmin(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

<<<<<<< HEAD
=======
  // Lightweight "online" tracking: touch last_seen on load and every 2
  // minutes while the tab is open. "Online" in the admin dashboard is
  // then just "last_seen within the last 5 minutes" — no presence
  // server needed.
  useEffect(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    if (!session) return
    const beat = () => supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id)
    beat()
    heartbeatRef.current = setInterval(beat, 2 * 60 * 1000)
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [session?.user.id])

>>>>>>> fix/password-reset-otp-admin-api
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string, fields: SignUpFields) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fields.full_name,
          username: fields.username,
          country: fields.country,
          role: fields.role,
          referred_by_code: fields.referredByCode || null,
        },
<<<<<<< HEAD
=======
        // Always the current deployed origin — never hardcoded to
        // localhost. On production this resolves to
        // https://monadafricans.netlify.app automatically. For the actual
        // email to land on that domain (not a Supabase default), the
        // project's Auth → URL Configuration must also have this exact
        // origin set as the Site URL and listed under Redirect URLs —
        // that part can only be done from the Supabase dashboard.
>>>>>>> fix/password-reset-otp-admin-api
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) throw error
  }

<<<<<<< HEAD
=======
  async function resendVerificationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    })
    if (error) throw error
  }

>>>>>>> fix/password-reset-otp-admin-api
  async function signOut() {
    await supabase.auth.signOut()
  }

<<<<<<< HEAD
  async function resetPasswordRequest(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
=======
  // Supabase Auth's native 6-digit-code recovery flow — anon-key-only,
  // no service-role key, no server-side function, no redirect/link
  // involved at all. This sends Supabase's own built-in "Reset
  // Password" auth email (SMTP is Resend, configured as Custom SMTP in
  // the Supabase dashboard, which is also what unlocked editing that
  // email's template). The template must render {{ .Token }} — the
  // real 6-digit numeric OTP GoTrue generates for this email — and NOT
  // {{ .ConfirmationURL }} (a link) or {{ .TokenHash }} (a long hash
  // meant for URLs, not for a human to type in). verifyPasswordResetOtp
  // below exchanges that same code for a real recovery session via
  // Supabase's own supabase.auth.verifyOtp({ type: 'recovery' }).
  async function resetPasswordRequest(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  // Exchanges the 6-digit code from the "Reset Password" email for a
  // real recovery session — Supabase Auth's own native OTP support
  // (type: 'recovery'). Needs nothing but the anon key already in use
  // everywhere else in this file: no custom OTP table, no server-side
  // function, and it inherits Supabase's own single-use/expiry/
  // rate-limit guarantees on the code itself. Throws on an invalid or
  // expired code — callers show that inline rather than silently
  // failing. On success this establishes a session, so the immediately
  // following updatePassword() call below has something to act on.
  async function verifyPasswordResetOtp(email: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' })
>>>>>>> fix/password-reset-otp-admin-api
    if (error) throw error
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  async function refreshProfile() {
    await loadProfileAndAdmin(session)
  }

  return (
    <AuthContext.Provider
<<<<<<< HEAD
      value={{ session, profile, loading, isAdmin, signIn, signUp, signOut, resetPasswordRequest, updatePassword, refreshProfile }}
=======
      value={{
        session,
        profile,
        loading,
        isAdmin: adminRole !== null,
        adminRole,
        isSuperAdmin: adminRole === 'super_admin',
        banned,
        signIn,
        signUp,
        signOut,
        resetPasswordRequest,
        verifyPasswordResetOtp,
        updatePassword,
        refreshProfile,
        resendVerificationEmail,
      }}
>>>>>>> fix/password-reset-otp-admin-api
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
