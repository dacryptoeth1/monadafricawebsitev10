import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { confirmEventVerification, requestEventVerification } from '../lib/eventVerification'
import type { EventListing, EventVerificationStatus } from '../types'

// A completely separate feature from the registration form above it in
// EventRegistrationModal: this proves the signed-in ACCOUNT's email
// (not whatever was typed into the registration form) and, only once
// proven, hands out a personal invite code tied to that account for
// this one event. See supabase/migrations/0033_... and
// netlify/functions/event-verify-{request,confirm}.ts. Only rendered
// when event.requires_email_verification is true — every other event
// is entirely unaffected.

type Step = 'loading' | 'confirm_email' | 'sending' | 'code_entry' | 'verifying' | 'verified' | 'unavailable'

const RESEND_COOLDOWN_SECONDS = 60

export default function EventVerificationPanel({ event }: { event: EventListing }) {
  const [step, setStep] = useState<Step>('loading')
  const [accountEmail, setAccountEmail] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [copied, setCopied] = useState(false)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadStatus() {
      const { data, error: rpcErr } = await supabase.rpc('get_event_verification_status', { p_event_id: event.id })
      if (cancelled) return
      if (rpcErr) {
        console.error('[EventVerificationPanel] get_event_verification_status failed:', rpcErr)
        setStep('confirm_email')
        return
      }
      const row = (Array.isArray(data) ? data[0] : data) as EventVerificationStatus | undefined
      setAccountEmail(row?.account_email ?? null)
      if (row?.verified && row.invite_code) {
        setInviteCode(row.invite_code)
        setStep('verified')
      } else if (row?.has_pending_code) {
        setStep('code_entry')
      } else {
        setStep('confirm_email')
      }
    }
    loadStatus()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  useEffect(() => {
    return () => { if (cooldownTimer.current) clearInterval(cooldownTimer.current) }
  }, [])

  function startCooldown(seconds: number) {
    setCooldown(seconds)
    if (cooldownTimer.current) clearInterval(cooldownTimer.current)
    cooldownTimer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  async function sendCode() {
    setError(null)
    setStep('sending')
    const result = await requestEventVerification(event.id)
    if (result.ok && 'already_verified' in result) {
      setInviteCode(result.invite_code)
      setStep('verified')
      return
    }
    if (result.ok) {
      setAttemptsRemaining(result.max_attempts)
      setStep('code_entry')
      startCooldown(RESEND_COOLDOWN_SECONDS)
      return
    }
    if (result.error === 'cooldown') {
      startCooldown(result.retry_after_seconds ?? RESEND_COOLDOWN_SECONDS)
      setStep('code_entry')
      return
    }
    if (result.error === 'closed') {
      setStep('unavailable')
      return
    }
    setError(friendlyError(result.error))
    setStep('confirm_email')
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setStep('verifying')
    const result = await confirmEventVerification(event.id, code)
    if (result.ok) {
      setInviteCode(result.invite_code)
      setStep('verified')
      return
    }
    if (result.error === 'too_many_attempts') {
      setError("Too many incorrect attempts. Request a new code to try again.")
      setAttemptsRemaining(0)
      setStep('code_entry')
      setCode('')
      return
    }
    if (result.attempts_remaining !== undefined) setAttemptsRemaining(result.attempts_remaining)
    setError(friendlyError(result.error))
    setCode('')
    setStep('code_entry')
  }

  if (step === 'loading') return null
  if (step === 'unavailable') {
    return (
      <PanelShell>
        <div className="text-sm text-white/50 text-center py-2">Email verification is closed for this event.</div>
      </PanelShell>
    )
  }

  if (step === 'verified' && inviteCode) {
    return (
      <PanelShell>
        <div className="flex items-center gap-2 mb-3 text-emerald-300 text-sm font-semibold">
          <Check size={16} /> Email verified
        </div>
        <div className="rounded-xl border border-purple/30 bg-purple/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-purple-light mb-2">Your Event Invite Code</div>
          <div className="flex items-center justify-between gap-3">
            <code className="font-mono text-lg tracking-wider text-white break-all">{inviteCode}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(inviteCode).catch(() => {})
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/10 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>
        </div>
      </PanelShell>
    )
  }

  return (
    <PanelShell>
      <div className="flex items-center gap-2 mb-3 text-purple-light text-sm font-semibold">
        <ShieldCheck size={16} /> Verify Email &amp; Get Invite Code
      </div>

      {(step === 'confirm_email' || step === 'sending') && (
        <div className="flex flex-col gap-3">
          <p className="text-white/50 text-xs leading-relaxed">
            Confirm your account email to receive a verification code. Once verified, you'll get a unique invite code for this event.
          </p>
          {accountEmail && (
            <div className="flex items-center gap-2 text-sm text-white/80 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <Mail size={14} className="text-white/40 shrink-0" /> {accountEmail}
            </div>
          )}
          {error && <div className="text-xs text-rose-300">{error}</div>}
          <button
            onClick={sendCode}
            disabled={step === 'sending'}
            className="px-4 py-2.5 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50"
          >
            {step === 'sending' ? 'Sending code…' : 'Send Verification Code'}
          </button>
        </div>
      )}

      {(step === 'code_entry' || step === 'verifying') && (
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          <p className="text-white/50 text-xs leading-relaxed">
            Enter the 6-digit code sent to {accountEmail || 'your email'}. It expires in 10 minutes.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            className="input text-center tracking-[0.4em] font-mono text-lg"
          />
          {error && <div className="text-xs text-rose-300">{error}</div>}
          {attemptsRemaining !== null && attemptsRemaining > 0 && attemptsRemaining < 5 && (
            <div className="text-[11px] text-amber-300">{attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining.</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={step === 'verifying' || code.length !== 6}
              className="flex-1 px-4 py-2.5 rounded-full text-xs font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50"
            >
              {step === 'verifying' ? 'Verifying…' : 'Verify Code'}
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={cooldown > 0 || step === 'verifying'}
              className="px-4 py-2.5 rounded-full text-xs font-semibold border border-white/15 hover:bg-white/5 disabled:opacity-40"
            >
              {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Code'}
            </button>
          </div>
        </form>
      )}
    </PanelShell>
  )
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 pt-5 border-t border-white/10">{children}</div>
}

function friendlyError(code?: string): string {
  switch (code) {
    case 'invalid_code': return "That code isn't right — double-check and try again."
    case 'expired': return 'This code has expired. Request a new one.'
    case 'no_pending_code': return 'No code is pending — request a new one.'
    case 'too_many_attempts': return 'Too many incorrect attempts. Request a new code.'
    case 'not_authenticated': return 'Please sign in again and retry.'
    case 'send_failed': return "We couldn't send the code right now. Please try again in a moment."
    case 'closed': return 'Verification is closed for this event.'
    default: return 'Something went wrong. Please try again.'
  }
}
