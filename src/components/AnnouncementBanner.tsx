import { useEffect, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Announcement } from '../types'

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('announcements')
      .select('*')
      .eq('pinned', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAnnouncement((data as Announcement) ?? null))
  }, [])

  if (!announcement || dismissed === announcement.id) return null

  return (
    <div className="bg-gradient-to-r from-purple-glow to-purple text-sm">
      <div className="max-w-7xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Megaphone size={14} className="shrink-0" />
          <span className="truncate">
            <strong>{announcement.title}</strong>
            {announcement.body && <span className="opacity-80"> — {announcement.body}</span>}
          </span>
        </div>
        <button onClick={() => setDismissed(announcement.id)} className="shrink-0 opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
