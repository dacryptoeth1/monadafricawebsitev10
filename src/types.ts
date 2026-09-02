export type BountyCategory = 'Development' | 'Design' | 'Marketing' | 'Community' | 'Content'
export type BountyDifficulty = 'easy' | 'medium' | 'hard'
export type BountyStatus = 'pending' | 'approved' | 'rejected'

// The badge shown on every public bounty card — see migration 0037.
// 'verified' = published from an admin-reviewed bounty_hosting_requests
// row (publish_bounty_hosting_request()); 'partner' / 'community' are
// set by an admin for bounties created directly in the admin dashboard
// (AdminBounties.tsx) that didn't go through that request flow.
export type VerificationBadgeType = 'verified' | 'partner' | 'community'

// The post-publish completion lifecycle — independent of is_closed
// (open/closed for new submissions) and status/is_deleted. See
// migration 0037.
export type BountyCompletionStatus = 'none' | 'under_review' | 'completed' | 'cancelled' | 'expired'

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
  is_closed: boolean
  is_featured: boolean
  is_deleted: boolean
  deleted_at: string | null
  deleted_by: string | null
  closed_at: string | null
  closed_by: string | null
  created_at: string
  // Added in migration 0037 — see the Partnership & Bounty workflow.
  hosting_request_id: string | null
  verification_badge: VerificationBadgeType
  assigned_admin: string | null
  published_at: string | null
  completion_status: BountyCompletionStatus
}

export type NewBounty = Omit<Bounty, 'id' | 'status' | 'created_at'>

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

// Display-only label for the public-facing verification badge — folds
// completion_status/is_closed in on top of verification_badge so a
// completed/closed/expired bounty always shows that instead of its
// underlying verified/partner/community tier. See VerificationBadge.tsx.
export type PublicBadgeLabel = 'Verified by Monad Africa' | 'Partner Bounty' | 'Community Bounty' | 'Completed' | 'Submissions Closed' | 'Expired'

export function publicBadgeLabel(b: Pick<Bounty, 'verification_badge' | 'is_closed' | 'completion_status'>): PublicBadgeLabel {
  if (b.completion_status === 'completed') return 'Completed'
  if (b.completion_status === 'expired') return 'Expired'
  // 'cancelled' has no dedicated public badge in the spec — closest
  // accurate label is the same one shown for a closed/under-review
  // bounty, since a cancelled bounty must never look applyable either.
  if (b.is_closed || b.completion_status === 'under_review' || b.completion_status === 'cancelled') return 'Submissions Closed'
  if (b.verification_badge === 'verified') return 'Verified by Monad Africa'
  if (b.verification_badge === 'partner') return 'Partner Bounty'
  return 'Community Bounty'
}

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

export interface Profile {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  country: string | null
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
  created_at: string
  updated_at: string
}

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
  is_winner: boolean
  created_at: string
  // Added in migration 0037 — writable by the hosting project itself
  // (RLS + protect_submission_fields() trigger restrict a non-admin
  // updater to only these three columns), not by the applicant.
  shortlisted: boolean
  proposed_winner: boolean
  project_feedback: string | null
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

// Narrow view of `public.events` for the simple homepage announcement
// feed and the Admin → Events tab (title/type/date/link only — see
// EventListing above for the same table's registration columns).
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
  is_featured: boolean
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

// The official, admin-curated Monad Africa team shown on the public
// /team page — see supabase/migrations/0035. Deliberately distinct from
// `Profile` (a normal user account): a community member cannot make
// themselves show up here just by picking a role on their own profile.
export interface TeamMember {
  id: string
  name: string
  primary_role: string
  badges: string[]
  avatar_url: string | null
  x_url: string | null
  telegram_url: string | null
  bio: string | null
  is_bd_lead: boolean
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const PARTNERSHIP_TYPES = [
  'Ecosystem Partnership',
  'Community Collaboration',
  'Sponsorship',
  'University Programme',
  'Hackathon',
  'Builder Programme',
  'Event',
  'Media Partnership',
  'Project Collaboration',
  'Strategic Opportunity',
  'Other',
] as const
export type PartnershipType = (typeof PARTNERSHIP_TYPES)[number]

export const PARTNERSHIP_STATUSES = ['New', 'Reviewing', 'Contacted', 'Accepted', 'Declined', 'Archived'] as const
export type PartnershipStatus = (typeof PARTNERSHIP_STATUSES)[number]

// The "Partner With Monad Africa" (/partner) contact form — see
// supabase/migrations/0035. Never publicly readable; admin/BD-only.
export interface PartnershipSubmission {
  id: string
  full_name: string
  organization: string | null
  email: string
  x_url: string | null
  telegram: string | null
  website: string | null
  partnership_type: string
  message: string
  status: PartnershipStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

// --- Partnership & Bounty hosting workflow (migration 0037) ----------

export const PARTNERSHIP_APPLICATION_STATUSES = ['Pending Review', 'Contacted', 'Under Discussion', 'Approved', 'Rejected', 'Active Partnership'] as const
export type PartnershipApplicationStatus = (typeof PARTNERSHIP_APPLICATION_STATUSES)[number]

// The signed-in "Partner With Us" application — replaces the old
// anonymous partnership_submissions table (left untouched/historical,
// no longer written to). See supabase/migrations/0037.
export interface PartnershipApplication {
  id: string
  created_by: string
  project_name: string
  logo_url: string | null
  website: string | null
  x_username: string | null
  telegram: string | null
  contact_email: string
  contact_person: string
  category: string | null
  description: string | null
  partnership_type: string
  needs_from_us: string | null
  offers_to_us: string | null
  target_countries: string[]
  supporting_links: string | null
  additional_info: string | null
  status: PartnershipApplicationStatus
  admin_notes: string | null
  assigned_admin: string | null
  reviewed_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export const BOUNTY_HOSTING_REQUEST_STATUSES = ['draft', 'pending_review', 'changes_requested', 'approved', 'rejected'] as const
export type BountyHostingRequestStatus = (typeof BOUNTY_HOSTING_REQUEST_STATUSES)[number]

// The signed-in "Host a Bounty" application — the pre-publish review
// lifecycle. Once approved, an admin calls publish_bounty_hosting_request()
// which creates the actual public Bounty row (see hosting_request_id on
// Bounty above) and stamps published_bounty_id here. See migration 0037.
export interface BountyHostingRequest {
  id: string
  created_by: string
  project_name: string | null
  logo_url: string | null
  website: string | null
  x_username: string | null
  telegram: string | null
  contact_email: string | null
  contact_person: string | null
  title: string | null
  description: string | null
  category: BountyCategory | null
  required_skills: string | null
  eligibility: string | null
  deliverables: string | null
  num_winners: number | null
  total_reward: string | null
  reward_currency: string | null
  reward_distribution: string | null
  submission_deadline: string | null
  winner_announcement_date: string | null
  payment_method: string | null
  proof_of_funds_url: string | null
  relevant_links: string | null
  terms: string | null
  additional_info: string | null
  status: BountyHostingRequestStatus
  admin_notes: string | null
  assigned_admin: string | null
  reviewed_at: string | null
  approved_at: string | null
  published_bounty_id: string | null
  created_at: string
  updated_at: string
}

// One row of the private {submission_id, wallet_or_payment_details,
// reward_amount, tx_hash} winners array on BountyCompletionReport.
export interface CompletionReportWinner {
  submission_id: string
  wallet_or_payment_details: string
  reward_amount: string
  tx_hash: string
}

export const COMPLETION_REPORT_STATUSES = ['draft', 'submitted', 'approved'] as const
export type CompletionReportStatus = (typeof COMPLETION_REPORT_STATUSES)[number]

// The private, full completion report a project fills in after its
// bounty ends — only ever readable by its owner or an admin. The public
// site instead reads BountyCompletionReportPublic below. See migration
// 0037.
export interface BountyCompletionReport {
  id: string
  bounty_id: string
  created_by: string
  submissions_count: number | null
  winners: CompletionReportWinner[]
  summary: string | null
  winning_submission_links: string | null
  project_feedback: string | null
  participant_feedback: string | null
  unresolved_issues: string | null
  status: CompletionReportStatus
  admin_notes: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

// public.bounty_completion_reports_public — the sanitized subset shown
// on a completed bounty's public card. No wallet/payment/tx data.
export interface BountyCompletionReportPublic {
  bounty_id: string
  submissions_count: number | null
  summary: string | null
  winning_submission_links: string | null
  unresolved_issues: string | null
  approved_at: string
}

export type StatusHistoryEntityType = 'partnership_application' | 'bounty_hosting_request' | 'bounty'

export interface StatusHistoryEntry {
  id: string
  entity_type: StatusHistoryEntityType
  entity_id: string
  old_status: string | null
  new_status: string | null
  changed_by: string | null
  note: string | null
  created_at: string
}

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
  // Added in supabase/migrations/0040_event_organiser_fields.sql — the
  // official organiser shown on the public event card. Both nullable;
  // the UI falls back to "Monad Africa" / initials when blank.
  organiser_name: string | null
  organiser_logo_url: string | null
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
  discord_members: number
  countries_reached: number
  builders_onboarded: number
  community_partners: number
  x_url: string
  discord_url: string
  telegram_url: string
  telegram_members: number
  telegram_members_change_today: number
  discord_online_manual: number
  discord_joined_today: number
  discord_guild_id: string
  discord_widget_enabled: boolean
  updated_at: string
}

export const defaultSiteSettings: SiteSettings = {
  x_followers: 1103,
  x_followers_change_week: 21,
  discord_members: 1982,
  countries_reached: 4,
  builders_onboarded: 30,
  community_partners: 2,
  x_url: 'https://x.com/monadonafrica',
  discord_url: 'https://discord.gg/9Fj5KtQCS',
  telegram_url: 'https://t.me/monad_africa',
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

// public.ecosystem_activity (migration 0043) — "what's happening across
// Monad right now", combining global ecosystem intelligence with
// African Monad activity. Deliberately separate from Bounty/EventListing:
// this isn't a registerable event or an opportunity, it's an activity
// feed item (a stat, a milestone, a curated update, or a physical
// happening) that may or may not have a date.
export type EcosystemActivityStatus = 'live' | 'upcoming' | 'recent'
export type EcosystemActivityRegion = 'global' | 'africa'
// See EcosystemActivity.data_freshness below for what each value means
// and governs in the UI — never label something 'live' that isn't
// actually kept in sync by a scheduled job.
export type EcosystemActivityFreshness = 'live' | 'periodic' | 'curated'

// public.ecosystem_sources (migration 0044) — the structured registry
// ecosystem_activity entries can be attributed to. 'priority' is the
// six sources the redesign brief named explicitly; 'verified' is any
// other confirmed real project an admin adds later — the architecture
// supports unlimited sources without touching the Events page.
export type EcosystemSourceType = 'priority' | 'verified'

export interface EcosystemSource {
  id: string
  name: string
  handle: string | null
  category: string | null
  website: string | null
  logo_url: string | null
  description: string | null
  location: string | null
  source_type: EcosystemSourceType
  is_active: boolean
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

// public.community_stats (migration 0044) — real, timestamped snapshots
// written only by scripts/sync-community-stats.mjs, run by GitHub
// Actions (service-role, bypasses RLS) — never admin-editable. See
// CommunityStatsSection for how the
// frontend turns a run of these into "current count" + "+N today" +
// staleness handling.
export type CommunityStatPlatform = 'x' | 'discord' | 'telegram'

export interface CommunityStat {
  id: string
  platform: CommunityStatPlatform
  count: number
  source: string
  recorded_at: string
  created_at: string
}

export interface EcosystemActivity {
  id: string
  title: string
  description: string | null
  category: string | null
  status: EcosystemActivityStatus
  region: EcosystemActivityRegion
  location: string | null
  country: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  source_url: string | null
  source_name: string | null
  image_url: string | null
  statistic_value: string | null
  statistic_label: string | null
  data_freshness: EcosystemActivityFreshness
  is_published: boolean
  published_at: string
  last_synced_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
