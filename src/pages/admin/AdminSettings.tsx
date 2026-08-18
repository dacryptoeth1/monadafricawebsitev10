import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { runAdminAction } from '../../lib/adminActions'
import { defaultSiteSettings } from '../../types'
import type { SiteSettings } from '../../types'
import { invalidateSiteSettingsCache } from '../../hooks/useSiteSettings'

function isValidUrl(value: string): boolean {
  if (!value) return true // empty is allowed — several fields are optional
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export default function AdminSettings({ showToast }: { showToast: (msg: string) => void }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) showToast(error.message)
      if (data) setSettings(data as SiteSettings)
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function validate(): string[] {
    const problems: string[] = []
    const numericFields: [keyof SiteSettings, string][] = [
      ['x_followers', 'X Followers'],
      ['x_followers_change_week', 'X change this week'],
      ['telegram_members', 'Telegram members'],
      ['telegram_members_change_today', 'Telegram new members today'],
      ['discord_members', 'Discord members'],
      ['discord_online_manual', 'Discord online'],
      ['discord_joined_today', 'Discord joined today'],
      ['countries_reached', 'Countries reached'],
      ['builders_onboarded', 'Builders onboarded'],
      ['community_partners', 'Community partners'],
    ]
    for (const [key, label] of numericFields) {
      const v = settings[key] as number
      if (!Number.isFinite(v) || v < 0) problems.push(`${label} must be a non-negative number.`)
    }
    if (!isValidUrl(settings.x_url)) problems.push('X URL is not a valid http(s) URL.')
    if (!isValidUrl(settings.discord_url)) problems.push('Discord URL is not a valid http(s) URL.')
    if (!isValidUrl(settings.telegram_url)) problems.push('Telegram URL is not a valid http(s) URL.')
    if (settings.discord_guild_id && !/^\d{5,25}$/.test(settings.discord_guild_id)) {
      problems.push('Discord Server (Guild) ID should be numeric (as shown in Discord\'s widget settings).')
    }
    return problems
  }

  async function save() {
    const problems = validate()
    setErrors(problems)
    if (problems.length > 0) return

    setSaving(true)
    const ok = await runAdminAction(
      () => supabase.from('site_settings').update({ ...settings, updated_at: new Date().toISOString() }).eq('id', 1),
      showToast,
    )
    setSaving(false)
    // Public pages (Home/Bounties/Community) cache this row for the rest
    // of the browser session — see useSiteSettings.ts — so without this,
    // a change made here wouldn't show up on those pages until a full
    // reload even though it saved correctly.
    if (ok) { invalidateSiteSettingsCache(); showToast('Settings saved') }
  }

  if (!loaded) return <div className="text-white/40 text-sm">Loading…</div>

  return (
    <div className="max-w-xl">
      <p className="text-white/40 text-xs mb-6 leading-relaxed">These numbers display publicly. Keep them accurate.</p>

      {errors.length > 0 && (
        <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-xs text-rose-200">
          <div className="font-semibold mb-1">Fix before saving:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <h4 className="font-display font-semibold text-sm mb-3 text-white/80">🐦 X (Twitter) — manual</h4>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <NumField label="Followers" value={settings.x_followers} onChange={(v) => setSettings({ ...settings, x_followers: v })} />
        <NumField label="Change this week" value={settings.x_followers_change_week} onChange={(v) => setSettings({ ...settings, x_followers_change_week: v })} />
      </div>

      <h4 className="font-display font-semibold text-sm mb-3 text-white/80">💬 Telegram — manual</h4>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <NumField label="Total Members" value={settings.telegram_members} onChange={(v) => setSettings({ ...settings, telegram_members: v })} />
        <NumField label="New members today" value={settings.telegram_members_change_today} onChange={(v) => setSettings({ ...settings, telegram_members_change_today: v })} />
      </div>

      <h4 className="font-display font-semibold text-sm mb-3 text-white/80">🎮 Discord — live where possible</h4>
      <p className="text-white/35 text-[11px] mb-3 leading-relaxed">
        Member/online counts can be genuinely live via Discord's public widget — no bot or
        secret token needed. Enable it: Discord Server Settings → Widget → toggle "Enable
        Server Widget" → copy the Server ID below. If disabled or unreachable, the site
        automatically falls back to the manual numbers here instead.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <TextField label="Server (Guild) ID" value={settings.discord_guild_id} onChange={(v) => setSettings({ ...settings, discord_guild_id: v })} />
        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" checked={settings.discord_widget_enabled} onChange={(e) => setSettings({ ...settings, discord_widget_enabled: e.target.checked })} />
            Widget enabled (live)
          </label>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <NumField label="Members (manual fallback)" value={settings.discord_members} onChange={(v) => setSettings({ ...settings, discord_members: v })} />
        <NumField label="Online (manual fallback)" value={settings.discord_online_manual} onChange={(v) => setSettings({ ...settings, discord_online_manual: v })} />
        <NumField label="Joined today (manual)" value={settings.discord_joined_today} onChange={(v) => setSettings({ ...settings, discord_joined_today: v })} />
      </div>

      <h4 className="font-display font-semibold text-sm mb-3 text-white/80">Other stats</h4>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <NumField label="Countries Reached" value={settings.countries_reached} onChange={(v) => setSettings({ ...settings, countries_reached: v })} />
        <NumField label="Builders Onboarded" value={settings.builders_onboarded} onChange={(v) => setSettings({ ...settings, builders_onboarded: v })} />
        <NumField label="Community Partners" value={settings.community_partners} onChange={(v) => setSettings({ ...settings, community_partners: v })} />
      </div>

      <h4 className="font-display font-semibold text-sm mb-3 text-white/80">Links</h4>
      <div className="grid grid-cols-1 gap-4 mb-6">
        <TextField label="X URL" value={settings.x_url} onChange={(v) => setSettings({ ...settings, x_url: v })} />
        <TextField label="Discord Invite URL" value={settings.discord_url} onChange={(v) => setSettings({ ...settings, discord_url: v })} />
        <TextField label="Telegram URL" value={settings.telegram_url} onChange={(v) => setSettings({ ...settings, telegram_url: v })} />
      </div>

      <button onClick={save} disabled={saving} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="input" />
    </div>
  )
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  )
}
