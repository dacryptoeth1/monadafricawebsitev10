// Vercel serverless function, triggered on a schedule by Vercel Cron
// (see the `crons` entry in vercel.json — every 6 hours) — the one
// genuinely "live" data point on the /events "ecosystem activity" page
// (src/pages/Events.tsx). Everything else there is honestly labeled
// 'curated' (see migration 0043's header comment for why: no reliable
// public API exists for African Monad community activity specifically,
// so that data has to come from an admin with a real source URL).
//
// Source: DefiLlama's public, free, no-key-required API
// (https://api.llama.fi/v2/historicalChainTvl/Monad) — verified
// directly against the live endpoint while building this (see the PR/
// session notes); DefiLlama is a standard, widely-used public good for
// exactly this kind of on-chain TVL data, no scraping involved.
//
// Required env vars (Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// Optional:
//   CRON_SECRET   if set, this endpoint requires
//                 `Authorization: Bearer <CRON_SECRET>` — leave unset to
//                 allow Vercel Cron's plain scheduled GET (Vercel Cron
//                 does not send a custom header by default), or set it
//                 and add the same value as a header if you want this
//                 endpoint to reject any other caller.
//
// The row this upserts has a fixed id (seeded in migration 0043) so
// this is always a clean upsert of the same single row, never a
// growing pile of duplicate "TVL" entries.
const TVL_ROW_ID = '11111111-1111-4111-8111-111111111111'

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
}
interface VercelRes {
  status(code: number): VercelRes
  json(body: unknown): void
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${Math.round(value)}`
}

export default async function handler(req: VercelReq, res: VercelRes) {
  try {
    await run(req, res)
  } catch (err) {
    console.error('sync-ecosystem-tvl: unexpected failure:', err)
    res.status(500).json({ ok: false, error: 'internal_error' })
  }
}

async function run(req: VercelReq, res: VercelRes) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ ok: false, error: 'unauthorized' })
      return
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('sync-ecosystem-tvl: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    res.status(500).json({ ok: false, error: 'server_not_configured' })
    return
  }

  const tvlResp = await fetch('https://api.llama.fi/v2/historicalChainTvl/Monad')
  if (!tvlResp.ok) {
    console.error('sync-ecosystem-tvl: DefiLlama request failed:', tvlResp.status)
    res.status(502).json({ ok: false, error: 'source_unavailable' })
    return
  }
  const history = (await tvlResp.json()) as { date: number; tvl: number }[]
  const latest = Array.isArray(history) ? history[history.length - 1] : null
  if (!latest || typeof latest.tvl !== 'number') {
    console.error('sync-ecosystem-tvl: unexpected DefiLlama response shape')
    res.status(502).json({ ok: false, error: 'source_unavailable' })
    return
  }

  const now = new Date().toISOString()
  const upsertResp = await fetch(`${supabaseUrl}/rest/v1/ecosystem_activity?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([
      {
        id: TVL_ROW_ID,
        title: 'Monad Ecosystem TVL',
        description: 'Total value locked across DeFi protocols on Monad.',
        category: 'Statistic',
        status: 'live',
        region: 'global',
        source_url: 'https://defillama.com/chain/monad',
        source_name: 'DefiLlama',
        statistic_value: formatUsd(latest.tvl),
        statistic_label: 'Monad Ecosystem TVL',
        data_freshness: 'live',
        is_published: true,
        last_synced_at: now,
      },
    ]),
  })

  if (!upsertResp.ok) {
    const text = await upsertResp.text().catch(() => '')
    console.error('sync-ecosystem-tvl: Supabase upsert failed:', upsertResp.status, text)
    res.status(502).json({ ok: false, error: 'upsert_failed' })
    return
  }

  res.status(200).json({ ok: true, tvl: latest.tvl, formatted: formatUsd(latest.tvl), synced_at: now })
}
