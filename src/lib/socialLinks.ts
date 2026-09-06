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
