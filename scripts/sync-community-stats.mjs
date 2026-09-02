#!/usr/bin/env node
// Run on a schedule by .github/workflows/sync-community-stats.yml —
// fetches Monad Africa's REAL Discord and Telegram member counts and
// writes a timestamped snapshot into Supabase's community_stats table
// (migration 0044). This is a plain Node script (no new npm
// dependencies — native fetch, Node 20+) run by GitHub Actions rather
// than a Vercel function, because the bot tokens live as GitHub Actions
// repository secrets, not Vercel environment variables.
//
// Each platform is independent and best-effort: if one fails, the
// other still syncs, and NOTHING is written for the failed one — no
// zero, no placeholder. The frontend (src/components/CommunityStats.tsx)
// always reads the most recent row per platform, so a failed run just
// means the previous real count keeps showing, with its real timestamp
// making the staleness visible instead of the count silently dropping.
//
// Required secrets (GitHub repo -> Settings -> Secrets and variables ->
// Actions), injected as env vars by the workflow:
//   SUPABASE_URL                 (not sensitive — same value as this
//                                 project's VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY    (Supabase -> Project Settings -> API ->
//                                 service_role secret — bypasses RLS,
//                                 required because community_stats has
//                                 no admin write policy, only a
//                                 service-role bypass)
//   DISCORD_BOT_TOKEN            (bot must be a member of the guild —
//                                 see DISCORD_GUILD_ID below)
//   TELEGRAM_BOT_TOKEN           (bot must be an admin of @monad_africa)
//   X_BEARER_TOKEN                (X Developer Portal -> Project/App ->
//                                 Keys and tokens -> Bearer Token —
//                                 app-only auth, read-only, used only
//                                 for the public GET /2/users/by/username
//                                 lookup below. Server-side only: this
//                                 script runs in GitHub Actions, never
//                                 in the browser, so the token is never
//                                 shipped to the frontend.)
//
// Discord's guild id is read live from site_settings.discord_guild_id
// (Admin -> Settings) rather than duplicated as a second secret — "the
// Monad Africa server/guild configured for the bot" is exactly that
// existing value. Telegram's chat is the fixed public @monad_africa
// username per the redesign brief, not a secret. X's handle is the
// fixed public @MonadAfrica username for the same reason.
const TELEGRAM_CHAT_ID = '@monad_africa'
const X_USERNAME = 'MonadAfrica'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN

function fail(msg) {
  console.error(`::error::${msg}`)
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    fail('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — cannot write results even if the platform calls succeed.')
    process.exitCode = 1
    return
  }
  const restHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

  const outcomes = await Promise.all([syncDiscord(restHeaders), syncTelegram(restHeaders), syncX(restHeaders)])

  const anyOk = outcomes.some((o) => o.ok)
  const summary = outcomes.map((o) => `${o.platform}: ${o.ok ? `ok (${o.count})` : `FAILED — ${o.reason}`}`).join('\n')
  console.log(summary)

  if (!anyOk) {
    fail('Both Discord and Telegram sync failed this run — no rows written, last known good values remain live on the site.')
    process.exitCode = 1
  }
}

async function syncDiscord(restHeaders) {
  if (!DISCORD_BOT_TOKEN) {
    const reason = 'DISCORD_BOT_TOKEN not set'
    console.warn(`Discord: skipped — ${reason}`)
    return { platform: 'discord', ok: false, reason }
  }
  try {
    const settingsResp = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=discord_guild_id`, { headers: restHeaders })
    if (!settingsResp.ok) {
      const reason = `could not read site_settings (${settingsResp.status})`
      fail(`Discord: ${reason}`)
      return { platform: 'discord', ok: false, reason }
    }
    const rows = await settingsResp.json()
    const guildId = rows[0]?.discord_guild_id
    if (!guildId) {
      const reason = 'site_settings.discord_guild_id is not configured (Admin -> Settings)'
      fail(`Discord: ${reason}`)
      return { platform: 'discord', ok: false, reason }
    }

    const guildResp = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    })
    const guildData = await guildResp.json().catch(() => ({}))
    if (!guildResp.ok || typeof guildData.approximate_member_count !== 'number') {
      const reason = guildData.message || `Discord API returned ${guildResp.status} — is the bot actually a member of guild ${guildId}?`
      fail(`Discord: ${reason}`)
      return { platform: 'discord', ok: false, reason }
    }

    const count = guildData.approximate_member_count
    await writeStat(restHeaders, 'discord', count, 'api')
    console.log(`Discord: ${count} members (guild ${guildId})`)
    return { platform: 'discord', ok: true, count }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    fail(`Discord: ${reason}`)
    return { platform: 'discord', ok: false, reason }
  }
}

async function syncTelegram(restHeaders) {
  if (!TELEGRAM_BOT_TOKEN) {
    const reason = 'TELEGRAM_BOT_TOKEN not set'
    console.warn(`Telegram: skipped — ${reason}`)
    return { platform: 'telegram', ok: false, reason }
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMemberCount?chat_id=${encodeURIComponent(TELEGRAM_CHAT_ID)}`)
    const data = await resp.json().catch(() => ({}))
    if (!data.ok || typeof data.result !== 'number') {
      const reason = data.description || `Telegram API returned ${resp.status} — is the bot an admin of ${TELEGRAM_CHAT_ID}?`
      fail(`Telegram: ${reason}`)
      return { platform: 'telegram', ok: false, reason }
    }

    const count = data.result
    await writeStat(restHeaders, 'telegram', count, 'api')
    console.log(`Telegram: ${count} members (${TELEGRAM_CHAT_ID})`)
    return { platform: 'telegram', ok: true, count }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    fail(`Telegram: ${reason}`)
    return { platform: 'telegram', ok: false, reason }
  }
}

async function syncX(restHeaders) {
  if (!X_BEARER_TOKEN) {
    const reason = 'X_BEARER_TOKEN not set'
    console.warn(`X: skipped — ${reason}`)
    return { platform: 'x', ok: false, reason }
  }
  try {
    // Public metrics on the user-by-username lookup — read-only,
    // app-only Bearer auth, no OAuth user context needed. Real
    // follower count for @MonadAfrica, never estimated.
    const resp = await fetch(`https://api.twitter.com/2/users/by/username/${X_USERNAME}?user.fields=public_metrics`, {
      headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
    })
    const data = await resp.json().catch(() => ({}))
    const followers = data?.data?.public_metrics?.followers_count
    if (!resp.ok || typeof followers !== 'number') {
      const reason = data?.title || data?.detail || data?.errors?.[0]?.message || `X API returned ${resp.status} for @${X_USERNAME}`
      fail(`X: ${reason}`)
      return { platform: 'x', ok: false, reason }
    }

    await writeStat(restHeaders, 'x', followers, 'api')
    console.log(`X: ${followers} followers (@${X_USERNAME})`)
    return { platform: 'x', ok: true, count: followers }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    fail(`X: ${reason}`)
    return { platform: 'x', ok: false, reason }
  }
}

async function writeStat(restHeaders, platform, count, source) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/community_stats`, {
    method: 'POST',
    headers: { ...restHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify([{ platform, count, source, recorded_at: new Date().toISOString() }]),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Supabase insert failed for ${platform} (${resp.status}): ${text}`)
  }
}

main()
