export type BountyCategory = 'Development' | 'Design' | 'Marketing' | 'Community' | 'Content'
export type BountyDifficulty = 'easy' | 'medium' | 'hard'
export type BountyStatus = 'pending' | 'approved' | 'rejected'

export interface Bounty {
  id: string
  project_name: string
  logo_url: string | null
  website: string | null
  twitter: string | null
  discord: string | null
  contact_email: string
  title: string
  description: string
  skills_needed: string
  category: BountyCategory
  difficulty: BountyDifficulty
  reward: string
  deadline: string
  status: BountyStatus
<<<<<<< HEAD
=======
  is_closed: boolean
  is_featured: boolean
  is_deleted: boolean
  deleted_at: string | null
  deleted_by: string | null
  closed_at: string | null
  closed_by: string | null
>>>>>>> fix/password-reset-otp-admin-api
  created_at: string
}

export type NewBounty = Omit<Bounty, 'id' | 'status' | 'created_at'>

<<<<<<< HEAD
=======
// The four lifecycle states the Admin "Manage Bounties" panel and the
// public bounty pages actually reason about — derived from the
// existing status/is_closed/is_deleted columns rather than a fifth
// column duplicating them (see migration 0031). "rejected" bounties
// (an existing sub-state of the host-a-bounty moderation workflow)
// count as 'draft' here: like a pending bounty, they were never public
// and can't be participated in.
export type BountyLifecycleStatus = 'draft' | 'active' | 'closed' | 'deleted'

export function bountyLifecycleStatus(b: Pick<Bounty, 'status' | 'is_closed' | 'is_deleted'>): BountyLifecycleStatus {
  if (b.is_deleted) return 'deleted'
  if (b.status !== 'approved') return 'draft'
  return b.is_closed ? 'closed' : 'active'
}

>>>>>>> fix/password-reset-otp-admin-api
export interface Application {
  id: string
  bounty_id: string
  user_id: string | null
  full_name: string
  email: string
  portfolio_link: string | null
  message: string | null
  reviewed: boolean
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

<<<<<<< HEAD
export type UserRole = 'Developer' | 'Designer' | 'Content Creator' | 'Community Member' | 'Founder' | 'Student'

=======
// `public.leaderboard_public` (migration 0032) — the only source of
// other users' data that's actually readable by a logged-out visitor
// or an ordinary (non-admin) logged-in user. `profiles` itself only
// ever allows a row's owner (or an admin) to SELECT it — see the RLS
// policy history in 0001/0002/0014/0018 — so this view exists to
// safely expose just the public-facing leaderboard/profile-preview
// fields to everyone else, with every private column (email,
// wallet_address, bio, socials, suspension flags, ...) excluded by
// construction rather than by a filter that could be gotten wrong.
export interface PublicProfile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  country: string | null
  xp: number
  total_referrals: number
}

export type UserRole = 'Developer' | 'Designer' | 'Content Creator' | 'Community Member' | 'Founder' | 'Student'

export type AdminRole = 'super_admin' | 'admin' | 'moderator'

>>>>>>> fix/password-reset-otp-admin-api
export interface Profile {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  country: string | null
<<<<<<< HEAD
  role: UserRole | null
  avatar_url: string | null
  credits: number
  referral_code: string | null
  referred_by: string | null
  total_referrals: number
=======
  region: string | null
  role: UserRole | null
  avatar_url: string | null
  bio: string | null
  twitter: string | null
  telegram: string | null
  discord: string | null
  website: string | null
  github: string | null
  wallet_address: string | null
  wallet_provider: string | null
  credits: number
  xp: number
  is_ambassador: boolean
  profile_complete_bonus_awarded: boolean
  wallet_bonus_awarded: boolean
  first_submission_bonus_awarded: boolean
  notifications_enabled: boolean
  referral_code: string | null
  referred_by: string | null
  total_referrals: number
  is_suspended: boolean
  is_banned: boolean
  hide_from_leaderboard: boolean
  last_seen: string | null
>>>>>>> fix/password-reset-otp-admin-api
  created_at: string
  updated_at: string
}

<<<<<<< HEAD
=======
export interface Badge {
  code: string
  label: string
  emoji: string
  description: string | null
}

export interface UserBadge {
  user_id: string
  badge_code: string
  awarded_at: string
}

export interface XpTransaction {
  id: string
  user_id: string
  amount: number
  reason: string
  created_at: string
}

export interface XpRewardConfig {
  key: string
  label: string
  amount: number
  updated_at: string
}

export interface Report {
  id: string
  reporter_id: string | null
  target_type: 'bounty' | 'submission' | 'user'
  target_id: string
  reason: string
  status: 'open' | 'resolved' | 'dismissed'
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string | null
  pinned: boolean
  created_by: string | null
  created_at: string
}

export interface RoadmapItem {
  title: string
  description: string
  status: 'done' | 'in_progress' | 'planned'
}

export interface FaqItem {
  question: string
  answer: string
}

export interface SiteContent {
  hero_title: string
  hero_subtitle: string
  hero_primary_label: string
  hero_primary_href: string
  hero_secondary_label: string
  hero_secondary_href: string
  footer_text: string
  roadmap_items: RoadmapItem[]
  faq_items: FaqItem[]
  updated_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  reason: string
  created_at: string
}

>>>>>>> fix/password-reset-otp-admin-api
export interface Submission {
  id: string
  application_id: string | null
  bounty_id: string
  user_id: string
  github_repo: string | null
  x_post_link: string | null
  google_docs_link: string | null
  website_link: string | null
  file_url: string | null
  additional_notes: string | null
  status: 'pending' | 'approved' | 'rejected'
<<<<<<< HEAD
=======
  is_winner: boolean
>>>>>>> fix/password-reset-otp-admin-api
  created_at: string
}

export interface AppNotification {
  id: string
  user_id: string | null
  type: 'new_bounty' | 'submission_accepted' | 'submission_rejected' | 'credits_refreshed' | 'event_announced' | 'referral' | 'application_update'
  title: string
  message: string | null
  read: boolean
  created_at: string
}

<<<<<<< HEAD
=======
// Narrow view of `public.events` for the simple homepage announcement
// feed and the Admin → Events tab (title/type/date/link only — see
// EventListing above for the same table's registration columns).
>>>>>>> fix/password-reset-otp-admin-api
export interface EventItem {
  id: string
  title: string
  description: string | null
  event_date: string | null
  event_type: string | null
  link: string | null
  created_at: string
}

export interface NewsItem {
  id: string
  title: string
  summary: string | null
  link: string | null
  published_at: string
  created_at: string
}

export interface EcosystemProject {
  id: string
  name: string
  logo_url: string | null
  website: string | null
  description: string | null
  category: string | null
<<<<<<< HEAD
=======
  is_featured: boolean
>>>>>>> fix/password-reset-otp-admin-api
  created_at: string
}

export interface Resource {
  id: string
  title: string
  description: string | null
  url: string
  type: string | null // e.g. 'guide' | 'docs' | 'tool'
  created_at: string
}

export interface Video {
  id: string
  title: string
  youtube_url: string
  description: string | null
  created_at: string
}

export interface Partner {
  id: string
  name: string
  logo_url: string | null
  website: string | null
  created_at: string
}

<<<<<<< HEAD
export interface SiteSettings {
  x_followers: number
=======
export type EventListingStatus = 'draft' | 'published' | 'cancelled'

// Registration-capable view of `public.events` — the SAME table the
// simpler homepage/admin "Events" announcement feed reads (EventItem
// below), just selecting the additional registration/check-in columns
// added in supabase/migrations/0016_events_table_unification.sql. There
// is no separate `event_listings` table — an earlier round's design
// (0015_event_registration_system.sql) planned one but it was never
// actually created on this project's database, so 0016 unified
// everything onto `events` + `event_registrations` instead.
export interface EventListing {
  id: string
  title: string
  description: string | null
  // Nullable: `events.event_date` has no NOT NULL constraint, and events
  // created via the simpler Admin → Events tab (AdminCollectionPanel) can
  // be saved without a date. Was previously (incorrectly) typed as a
  // guaranteed string — see formatEventDate() in lib/eventStatus.ts.
  event_date: string | null
  event_type: string | null
  link: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  image_url: string | null
  event_url: string | null
  capacity: number | null
  registration_deadline: string | null
  registration_open: boolean
  status: EventListingStatus
  created_by: string | null
  created_at: string
  updated_at: string
  // Added in supabase/migrations/0033_event_email_verification_and_invite_codes.sql.
  // Opt-in per event, defaults to false — an entirely separate feature
  // from the instant-invite-code registration flow above: when true,
  // the Events page also offers "Verify Email & Get Invite Code",
  // gated behind proving ownership of the signed-in account's email.
  requires_email_verification: boolean
}

export interface EventRegistration {
  id: string
  event_id: string
  full_name: string
  email: string
  country: string
  twitter: string | null
  phone: string | null
  wallet_address: string | null
  invite_code: string
  checked_in: boolean
  checked_in_at: string | null
  checked_in_by: string | null
  email_sent: boolean
  email_sent_at: string | null
  email_last_error: string | null
  created_at: string
  updated_at: string
}

// Client-visible shape of get_event_verification_status() — the DB
// function backing the new email-verification invite-code feature
// (0033). Deliberately excludes anything about the OTP itself
// (code_hash/salt/attempt_count never leave the server).
export interface EventVerificationStatus {
  verified: boolean
  invite_code: string | null
  has_pending_code: boolean
  pending_expires_at: string | null
  account_email: string | null
}

// Row shape returned by admin_list_event_invite_codes() — admin-only,
// never includes the OTP/hash, only the outcome.
export interface EventInviteCodeAdminRow {
  user_id: string
  email: string | null
  full_name: string | null
  invite_code: string
  status: 'active' | 'revoked'
  verified_at: string | null
  created_at: string
}

export interface SiteSettings {
  x_followers: number
  x_followers_change_week: number
>>>>>>> fix/password-reset-otp-admin-api
  discord_members: number
  countries_reached: number
  builders_onboarded: number
  community_partners: number
  x_url: string
  discord_url: string
  telegram_url: string
<<<<<<< HEAD
=======
  telegram_members: number
  telegram_members_change_today: number
  discord_online_manual: number
  discord_joined_today: number
  discord_guild_id: string
  discord_widget_enabled: boolean
>>>>>>> fix/password-reset-otp-admin-api
  updated_at: string
}

export const defaultSiteSettings: SiteSettings = {
<<<<<<< HEAD
  x_followers: 130,
  discord_members: 160,
=======
  x_followers: 1103,
  x_followers_change_week: 21,
  discord_members: 1982,
>>>>>>> fix/password-reset-otp-admin-api
  countries_reached: 4,
  builders_onboarded: 30,
  community_partners: 2,
  x_url: 'https://x.com/monadonafrica',
  discord_url: 'https://discord.gg/tjY9t3PZF',
  telegram_url: 'https://t.me/monad_africa',
<<<<<<< HEAD
  updated_at: '',
}
=======
  telegram_members: 2587,
  telegram_members_change_today: 34,
  discord_online_manual: 132,
  discord_joined_today: 0,
  discord_guild_id: '',
  discord_widget_enabled: false,
  updated_at: '',
}

// Live Discord widget data (only used when discord_widget_enabled is
// true and the fetch succeeds — otherwise the manual fields above are
// shown instead, clearly labeled as manual).
export interface DiscordWidgetData {
  presence_count: number
  members: { id: string }[]
}
>>>>>>> fix/password-reset-otp-admin-api
