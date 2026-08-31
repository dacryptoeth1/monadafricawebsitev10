import type { DiscordWidgetData } from '../types'

// Discord's public widget.json endpoint requires no authentication —
// just the server enabling "Server Widget" in Settings → Widget and
// giving us the Server (Guild) ID. Returns null if the widget isn't
// enabled, the ID is wrong, or the request fails for any reason — the
// caller should fall back to the manual fields in that case.
export async function fetchDiscordWidget(guildId: string): Promise<DiscordWidgetData | null> {
  if (!guildId) return null
  try {
    const res = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`)
    if (!res.ok) return null
    const data = await res.json()
    if (typeof data.presence_count !== 'number') return null
    return data as DiscordWidgetData
  } catch {
    return null
  }
}
