import { type FormEvent, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { BountyCategory, BountyDifficulty } from '../types'
import Reveal from '../components/Reveal'
import { getErrorMessage, logError } from '../lib/errors'

const CATEGORIES: BountyCategory[] = ['Development', 'Design', 'Marketing', 'Community', 'Content']
const DIFFICULTIES: BountyDifficulty[] = ['easy', 'medium', 'hard']

export default function HostBounty() {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setLogoFile(file)
    setLogoPreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const data = new FormData(form)

    const projectName = String(data.get('project_name') || '').trim()
    const contactEmail = String(data.get('contact_email') || '').trim()
    const title = String(data.get('title') || '').trim()
    const description = String(data.get('description') || '').trim()
    const reward = String(data.get('reward') || '').trim()
    const deadline = String(data.get('deadline') || '')

    if (!projectName || !contactEmail || !title || !description || !reward || !deadline) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    try {
      let logoUrl: string | null = null
      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('logos').upload(path, logoFile)
        if (uploadErr) throw uploadErr
        const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
        logoUrl = pub.publicUrl
      }

      const { error: insertErr } = await supabase.from('bounties').insert({
        project_name: projectName,
        logo_url: logoUrl,
        website: String(data.get('website') || ''),
        twitter: String(data.get('twitter') || ''),
        discord: String(data.get('discord') || ''),
        contact_email: contactEmail,
        title,
        description,
        skills_needed: String(data.get('skills_needed') || ''),
        category: data.get('category') as BountyCategory,
        difficulty: data.get('difficulty') as BountyDifficulty,
        reward,
        deadline,
        status: 'pending',
      })
      if (insertErr) throw insertErr

      setDone(true)
      form.reset()
      setLogoFile(null)
      setLogoPreview(null)
    } catch (err) {
      // Previously a bare `catch { setError('generic message') }` — the
      // actual Supabase/Postgrest error (e.g. a missing-column
      // PGRST204, an RLS denial, a storage upload failure) was silently
      // discarded instead of logged, making this exact class of bug
      // undiagnosable from the browser console. Now logged in full and
      // surfaced to the user when it adds real information.
      logError('[HostBounty] bounty submission failed:', err)
      setError(getErrorMessage(err, 'Something went wrong submitting this — please try again in a moment.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="pt-36 pb-28 min-h-screen">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal className="text-center mb-12">
          <span className="font-mono text-xs uppercase tracking-wider text-purple-light">Host a bounty</span>
          <h1 className="font-display font-semibold text-4xl md:text-5xl mt-4 mb-4">Reach Africa's builders.</h1>
          <p className="text-white/55 max-w-lg mx-auto">
            Submit your bounty below. Our team reviews every submission before it goes live.
          </p>
        </Reveal>

        {done ? (
          <Reveal>
            <div className="rounded-squircle border border-white/10 bg-panel/60 p-14 text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center text-2xl">✓</div>
              <h2 className="font-display font-semibold text-2xl mb-2">Bounty submitted for review.</h2>
              <p className="text-white/55 max-w-md mx-auto leading-relaxed">
                We'll review it shortly and reach out at the contact email you provided.
              </p>
            </div>
          </Reveal>
        ) : (
          <Reveal>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project Name" name="project_name" required />
              <Field label="Contact Email" name="contact_email" type="email" required />
              <Field label="Website" name="website" type="url" />
              <Field label="X (Twitter)" name="twitter" placeholder="@yourproject" />
              <Field label="Discord" name="discord" placeholder="discord.gg/..." />

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Logo Upload</label>
                <label className="input flex items-center gap-3 cursor-pointer">
                  <UploadCloud size={16} className="text-white/40 shrink-0" />
                  <span className="text-white/50 text-sm truncate">{logoFile ? logoFile.name : 'Choose an image file'}</span>
                  <input type="file" accept="image/*" onChange={onLogoChange} className="hidden" />
                </label>
                {logoPreview && <img src={logoPreview} alt="Logo preview" className="w-12 h-12 rounded-xl object-cover mt-1 border border-white/10" />}
              </div>

              <Field label="Bounty Title" name="title" required className="sm:col-span-2" />

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Category</label>
                <select name="category" required className="input" defaultValue="Development">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Difficulty</label>
                <select name="difficulty" required className="input" defaultValue="medium">
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>

              <Field label="Skills Needed" name="skills_needed" placeholder="e.g. React, Solidity" className="sm:col-span-2" />
              <Field label="Reward" name="reward" required placeholder="e.g. $1,200" />
              <Field label="Deadline" name="deadline" type="date" required />

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">Description</label>
                <textarea name="description" required rows={5} className="input resize-y" />
              </div>

              {error && <div className="sm:col-span-2 text-sm text-rose-300 bg-rose-300/10 border border-rose-300/25 rounded-xl px-4 py-3">{error}</div>}

              <div className="sm:col-span-2 flex justify-center mt-2">
                <button type="submit" disabled={submitting} className="px-8 py-4 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50 hover:-translate-y-0.5 transition-transform">
                  {submitting ? 'Submitting…' : 'Submit for Review →'}
                </button>
              </div>
            </form>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function Field({ label, name, type = 'text', required, placeholder, className = '' }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label} {required && <span className="text-purple-light">*</span>}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} className="input" />
    </div>
  )
}
