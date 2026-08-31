import type { UserRole } from '../types'

// Single source of truth for the values public.profiles.role's CHECK
// constraint (profiles_role_check) accepts. Both Signup and the Edit
// Profile form import this list instead of each declaring their own
// copy, so the two can never drift apart.
export const USER_ROLES: UserRole[] = ['Developer', 'Designer', 'Content Creator', 'Community Member', 'Founder', 'Student']

// Defensive normalization for any role value about to be sent to
// Supabase (a signup form field, an edit-profile <select>, or auth
// metadata read back out of raw_user_meta_data). A <select> built from
// USER_ROLES above should never produce anything else, but this is the
// backstop that guarantees the exact-cased value the database's CHECK
// constraint requires — case/whitespace-insensitive match against the
// real values, never a guess or a partial value. Returns null (never
// an invalid string) if the input doesn't correspond to a real role,
// so callers can omit the field entirely rather than risk sending
// something that would violate profiles_role_check.
export function normalizeUserRole(input: string | null | undefined): UserRole | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  return USER_ROLES.find((r) => r.toLowerCase() === trimmed.toLowerCase()) ?? null
}
