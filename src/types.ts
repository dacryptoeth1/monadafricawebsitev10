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
  created_at: string
}

export type NewBounty = Omit<Bounty, 'id' | 'status' | 'created_at'>

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

export type UserRole = 'Developer' | 'Designer' | 'Content Creator' | 'Community Member' | 'Founder' | 'Student'

export interface Profile {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  country: string | null
  role: UserRole | null
  avatar_url: string | null
  credits: number
  referral_code: string | null
  referred_by: string | null
  total_referrals: number
  created_at: string
  updated_at: string
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

export interface SiteSettings {
  x_followers: number
  discord_members: number
  countries_reached: number
  builders_onboarded: number
  community_partners: number
  x_url: string
  discord_url: string
  telegram_url: string
  updated_at: string
}

export const defaultSiteSettings: SiteSettings = {
  x_followers: 130,
  discord_members: 160,
  countries_reached: 4,
  builders_onboarded: 30,
  community_partners: 2,
  x_url: 'https://x.com/monadonafrica',
  discord_url: 'https://discord.gg/tjY9t3PZF',
  telegram_url: 'https://t.me/monad_africa',
  updated_at: '',
}
