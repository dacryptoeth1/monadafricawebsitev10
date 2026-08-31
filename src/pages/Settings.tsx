import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Reveal from '../components/Reveal'

export default function Settings() {
  const { profile, session, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)
  const [passwordErr, setPasswordErr] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [emailErr, setEmailErr] = useState<string | null>(null)

  const [notifSaving, setNotifSaving] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)

  if (!profile) return null

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPasswordErr(null)
    setPasswordMsg(null)
    if (newPassword.length < 6) {
      setPasswordErr('Password must be at least 6 characters.')
      return
    }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordMsg('Password updated.')
      setNewPassword('')
    } catch (err: any) {
      setPasswordErr(err?.message || 'Something went wrong.')
    } finally {
      setPasswordSaving(false)
    }
  }

  async function handleEmailChange(e: FormEvent) {
    e.preventDefault()
    setEmailErr(null)
    setEmailMsg(null)
    setEmailSaving(true)
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/login` },
      )
      if (error) throw error
      setEmailMsg('Check both your old and new inbox to confirm this change.')
      setNewEmail('')
    } catch (err: any) {
      setEmailErr(err?.message || 'Something went wrong.')
    } finally {
      setEmailSaving(false)
    }
  }

  async function toggleNotifications() {
    setNotifSaving(true)
    await supabase.from('profiles').update({ notifications_enabled: !profile!.notifications_enabled }).eq('id', profile!.id)
    await refreshProfile()
    setNotifSaving(false)
  }

  async function handleDelete() {
    setDeleteErr(null)
    if (deleteConfirm !== profile!.username) {
      setDeleteErr('Type your exact username to confirm.')
      return
    }
    setDeleting(true)
    try {
      const { error } = await supabase.rpc('self_delete_account')
      if (error) throw error
      await signOut()
      navigate('/')
    } catch (err: any) {
      setDeleteErr(err?.message || 'Something went wrong.')
      setDeleting(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-lg mx-auto px-6">
        <Reveal>
          <h1 className="font-display font-semibold text-3xl mb-2 text-center">Settings</h1>
          <p className="text-white/40 text-sm text-center mb-10">{session?.user.email}</p>
        </Reveal>

        <Reveal className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 mb-6">
          <h3 className="font-display font-semibold mb-4">Change Password</h3>
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="input" />
            {passwordErr && <div className="text-xs text-rose-300">{passwordErr}</div>}
            {passwordMsg && <div className="text-xs text-emerald-300">{passwordMsg}</div>}
            <button type="submit" disabled={passwordSaving} className="self-start px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
              {passwordSaving ? 'Saving…' : 'Update Password'}
            </button>
          </form>
        </Reveal>

        <Reveal className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 mb-6">
          <h3 className="font-display font-semibold mb-4">Change Email</h3>
          <form onSubmit={handleEmailChange} className="flex flex-col gap-3">
            <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="New email address" className="input" />
            {emailErr && <div className="text-xs text-rose-300">{emailErr}</div>}
            {emailMsg && <div className="text-xs text-emerald-300">{emailMsg}</div>}
            <button type="submit" disabled={emailSaving} className="self-start px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
              {emailSaving ? 'Saving…' : 'Update Email'}
            </button>
          </form>
        </Reveal>

        <Reveal className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold mb-1">Notifications</h3>
            <p className="text-white/40 text-xs">Receive in-app notifications for bounties, credits, and XP.</p>
          </div>
          <button
            onClick={toggleNotifications}
            disabled={notifSaving}
            className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${profile.notifications_enabled ? 'bg-purple' : 'bg-white/15'}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${profile.notifications_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </Reveal>

        <Reveal className="rounded-squircle border border-rose-400/20 bg-rose-400/[0.03] p-6">
          <h3 className="font-display font-semibold mb-2 text-rose-300">Delete Account</h3>
          <p className="text-white/40 text-xs leading-relaxed mb-4">
            This permanently removes your profile, applications, submissions, and credit/XP
            history. Your login itself isn't deleted by this action (that requires a separate
            backend step) but will have no profile data attached afterward. This cannot be
            undone. Type your username <strong className="text-white/60">{profile.username}</strong> to confirm.
          </p>
          <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Your username" className="input mb-3" />
          {deleteErr && <div className="text-xs text-rose-300 mb-3">{deleteErr}</div>}
          <button onClick={handleDelete} disabled={deleting} className="px-5 py-2.5 rounded-full text-sm font-semibold bg-rose-500/20 border border-rose-400/40 text-rose-300 hover:bg-rose-500/30 disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete My Account Data'}
          </button>
        </Reveal>
      </div>
    </section>
  )
}
