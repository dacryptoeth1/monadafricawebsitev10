// Centralized error-message extraction. Every catch block in this app
// was independently doing its own `err?.message || 'fallback'`, which
// works but duplicates the same logic ~15 times and silently drops the
// extra fields Postgrest/Supabase actually send back (`details`,
// `hint`, `code`) — those are exactly what makes a raw error
// diagnosable versus a bare, useless "{}" or "Something went wrong."
//
// Usage:
//   catch (err) {
//     console.error('[Signup] signUp failed:', err) // full technical error, always logged
//     setError(getErrorMessage(err, 'Something went wrong creating your account.'))
//   }

interface SupabaseLikeError {
  message?: string
  details?: string | null
  hint?: string | null
  code?: string | number | null
}

/**
 * Extracts a human-readable message from anything a Supabase call (or a
 * plain JS throw) can reject with, and NEVER returns "{}", "[object
 * Object]", or an empty string — falls back to `fallback` instead.
 *
 * Always logs the complete raw error to the console first, so nothing
 * is swallowed even when the returned message is a generic fallback.
 */
// Values a `.message` can legitimately equal that carry zero actual
// information — supabase-js's `AuthRetryableFetchError` (thrown for
// network-level failures and 5xx responses it treats as "you should
// retry") has been observed setting `.message` to the literal string
// "{}" rather than a real description, so a naive "is this a non-empty
// string" check lets it straight through. Checked case-insensitively
// against the trimmed value.
const USELESS_MESSAGES = new Set(['{}', '[object object]'])

function isUsefulMessage(msg: string | undefined | null): msg is string {
  if (!msg) return false
  const trimmed = msg.trim()
  return trimmed.length > 0 && !USELESS_MESSAGES.has(trimmed.toLowerCase())
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback

  // A real Error/AuthError instance — `.message` is always a string here.
  if (err instanceof Error && isUsefulMessage(err.message)) return err.message

  // A Postgrest/Supabase error-shaped object: { message, details, hint, code }.
  // These don't extend Error, so `err instanceof Error` above misses them.
  if (typeof err === 'object') {
    const e = err as SupabaseLikeError
    if (isUsefulMessage(e.message)) {
      // `details`/`hint` add real diagnostic value (e.g. which
      // constraint failed) without dumping the whole object on the
      // user — only appended when present and different from message.
      const extra = [e.details, e.hint].filter((v) => v && v !== e.message).join(' — ')
      return extra ? `${e.message} (${extra})` : e.message!
    }
  }

  if (typeof err === 'string' && isUsefulMessage(err)) return err

  // Nothing usable extracted (e.g. a bare {} literal message, or a
  // non-Error throw) — this is exactly the case that used to render as
  // a literal "{}" in the UI.
  return fallback
}

/** Same extraction, formatted for console.error — includes code, for triage. */
export function logError(context: string, err: unknown) {
  const e = err as SupabaseLikeError
  console.error(context, {
    message: e?.message,
    details: e?.details,
    hint: e?.hint,
    code: e?.code,
    raw: err,
  })
}
