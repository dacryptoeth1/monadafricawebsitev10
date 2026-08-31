import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { FaqItem, RoadmapItem, SiteContent } from '../../types'

const EMPTY: SiteContent = {
  hero_title: '',
  hero_subtitle: '',
  hero_primary_label: '',
  hero_primary_href: '',
  hero_secondary_label: '',
  hero_secondary_href: '',
  footer_text: '',
  roadmap_items: [],
  faq_items: [],
  updated_at: '',
}

export default function AdminHomepage({ showToast }: { showToast: (msg: string) => void }) {
  const [content, setContent] = useState<SiteContent>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('site_content').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setContent(data as unknown as SiteContent)
      setLoaded(true)
    })
  }, [])

  async function save() {
    const { error } = await supabase.from('site_content').update({ ...content, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) { showToast(error.message); return }
    showToast('Homepage content saved')
  }

  function updateRoadmap(items: RoadmapItem[]) {
    setContent({ ...content, roadmap_items: items })
  }
  function updateFaq(items: FaqItem[]) {
    setContent({ ...content, faq_items: items })
  }

  if (!loaded) return <div className="text-white/40 text-sm">Loading…</div>

  return (
    <div className="max-w-2xl">
      <p className="text-white/40 text-xs mb-6 leading-relaxed">
        This content drives the homepage hero, buttons, footer tagline, roadmap, and FAQ —
        changes here go live immediately, no code changes needed. Super Admin only.
      </p>

      <Section title="Hero">
        <TextField label="Title" value={content.hero_title} onChange={(v) => setContent({ ...content, hero_title: v })} />
        <TextAreaField label="Subtitle" value={content.hero_subtitle} onChange={(v) => setContent({ ...content, hero_subtitle: v })} />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="Primary Button Label" value={content.hero_primary_label} onChange={(v) => setContent({ ...content, hero_primary_label: v })} />
          <TextField label="Primary Button Link" value={content.hero_primary_href} onChange={(v) => setContent({ ...content, hero_primary_href: v })} />
          <TextField label="Secondary Button Label" value={content.hero_secondary_label} onChange={(v) => setContent({ ...content, hero_secondary_label: v })} />
          <TextField label="Secondary Button Link" value={content.hero_secondary_href} onChange={(v) => setContent({ ...content, hero_secondary_href: v })} placeholder="'discord' or a URL" />
        </div>
      </Section>

      <Section title="Footer">
        <TextAreaField label="Footer Tagline" value={content.footer_text} onChange={(v) => setContent({ ...content, footer_text: v })} />
      </Section>

      <Section title="Roadmap">
        {content.roadmap_items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 mb-2 items-center">
            <input value={item.title} onChange={(e) => updateRoadmap(content.roadmap_items.map((it, j) => (j === i ? { ...it, title: e.target.value } : it)))} placeholder="Title" className="input text-sm" />
            <input value={item.description} onChange={(e) => updateRoadmap(content.roadmap_items.map((it, j) => (j === i ? { ...it, description: e.target.value } : it)))} placeholder="Description" className="input text-sm" />
            <select value={item.status} onChange={(e) => updateRoadmap(content.roadmap_items.map((it, j) => (j === i ? { ...it, status: e.target.value as RoadmapItem['status'] } : it)))} className="input text-sm">
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <button onClick={() => updateRoadmap(content.roadmap_items.filter((_, j) => j !== i))} className="text-white/40 hover:text-rose-300"><Trash2 size={15} /></button>
          </div>
        ))}
        <button onClick={() => updateRoadmap([...content.roadmap_items, { title: '', description: '', status: 'planned' }])} className="flex items-center gap-1.5 text-xs text-purple-light mt-2">
          <Plus size={13} /> Add roadmap item
        </button>
      </Section>

      <Section title="FAQ">
        {content.faq_items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 items-start">
            <input value={item.question} onChange={(e) => updateFaq(content.faq_items.map((it, j) => (j === i ? { ...it, question: e.target.value } : it)))} placeholder="Question" className="input text-sm" />
            <textarea value={item.answer} onChange={(e) => updateFaq(content.faq_items.map((it, j) => (j === i ? { ...it, answer: e.target.value } : it)))} placeholder="Answer" rows={2} className="input text-sm" />
            <button onClick={() => updateFaq(content.faq_items.filter((_, j) => j !== i))} className="text-white/40 hover:text-rose-300 mt-2"><Trash2 size={15} /></button>
          </div>
        ))}
        <button onClick={() => updateFaq([...content.faq_items, { question: '', answer: '' }])} className="flex items-center gap-1.5 text-xs text-purple-light mt-2">
          <Plus size={13} /> Add FAQ item
        </button>
      </Section>

      <button onClick={save} className="px-6 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple mt-4">Save Homepage Content</button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 pb-8 border-b border-white/10">
      <h4 className="font-display font-semibold text-sm mb-4 text-white/80">{title}</h4>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input" />
    </div>
  )
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="input resize-y" />
    </div>
  )
}
