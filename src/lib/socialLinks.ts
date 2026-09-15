// `profiles.twitter` (see src/pages/Profile.tsx) is saved as a plain
// handle — the form's own placeholder is "@handle", and every other
// place that reads this column (Dashboard.tsx, AdminUsers.tsx) renders
// it as plain text, never as a link. BuilderCard/BuilderModal are the
// first place this field is used as a clickable `href`, so a bare
// handle needs turning into a real URL first — otherwise "@0xrhydar"
// would be used as-is and resolve as a broken relative link on this
// site instead of opening the profile on X.
//
// This is unrelated to `team_members.x_url` / the two featured
// builders' override `twitter` values, which are already full URLs
// (copied from team_members) and pass through unchanged.
export function toXProfileUrl(handle: string): string {
  const trimmed = handle.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://x.com/${trimmed.replace(/^@/, '')}`
}

// Same defensive normalization for `profiles.website` — the form's
// placeholder ("https://") suggests a full URL, but nothing enforces
// it, and the same field is used elsewhere as plain display text, so a
// bare domain (e.g. "purple-layer.com") is a real possibility. Without
// a scheme, `href="purple-layer.com"` would resolve as a broken
// relative link on this site rather than an outbound one.
export function toAbsoluteUrl(url: string): string {
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

// Basic signup-time validation for `profiles.twitter` — accepts either
// a full profile URL (https://x.com/username or https://twitter.com/username,
// matching the exact examples the product spec calls out) or a bare
// handle (with or without a leading @), which is what toXProfileUrl()
// above and every existing profile already store. Real X/Twitter
// handles are 1-15 characters, letters/digits/underscore only — this
// is enough to reject "completely invalid/random text" (spaces,
// unrelated URLs, empty strings) without requiring a live lookup or
// any credential.
const X_HANDLE = '[A-Za-z0-9_]{1,15}'
const X_URL_RE = new RegExp(`^https?:\\/\\/(www\\.)?(twitter|x)\\.com\\/${X_HANDLE}\\/?(\\?.*)?$`, 'i')
const X_HANDLE_RE = new RegExp(`^@?${X_HANDLE}$`)

export function isValidXProfile(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return X_URL_RE.test(trimmed) || X_HANDLE_RE.test(trimmed)
}

// Basic signup-time validation for `profiles.discord` — this column has
// always stored a plain Discord username (see the "username" placeholder
// on the Edit Profile field), not a password or any credential. Accepts
// that same free-text username (new-format: 2-32 chars, lowercase
// letters/digits/underscore/period; legacy Name#1234 discriminator
// still allowed since old accounts may have one on file), or a Discord
// invite/user link, so a project that only has a server/profile link
// handy isn't blocked either. Rejects blank input and anything that's
// obviously not a handle or link (spaces, random prose).
const DISCORD_USERNAME_RE = /^[a-z0-9_.]{2,32}(#\d{4})?$/i
const DISCORD_URL_RE = /^https?:\/\/(www\.)?discord(app)?\.(com|gg)\/.+$/i

export function isValidDiscordHandle(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return DISCORD_URL_RE.test(trimmed) || DISCORD_USERNAME_RE.test(trimmed)
}
