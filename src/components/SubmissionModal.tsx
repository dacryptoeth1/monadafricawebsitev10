import { type FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Application, Bounty } from '../types'
import { getErrorMessage, logError } from '../lib/errors'

interface AppRow extends Application {
  bounties: Pick<Bounty, 'title' | 'reward'> | null
}

export default function SubmissionModal({
  application,
  onClose,
  onSubmitted,
}: {
  application: AppRow
  onClose: () => void
  onSubmitted: () => void
}) {
  const { profile } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    const data = new FormData(e.currentTarget)
    setSubmitting(true)
    try {
      let fileUrl: string | null = null
      if (file) {
        const path = `${profile.id}/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage.from('submission-files').upload(path, file)
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('submission-files').getPublicUrl(path)
        fileUrl = pub.publicUrl
      }

      const { error: insertErr } = await supabase.from('submissions').insert({
        application_id: application.id,
        bounty_id: application.bounty_id,
        user_id: profile.id,
        github_repo: String(data.get('github_repo') || ''),
        x_post_link: String(data.get('x_post_link') || ''),
        google_docs_link: String(data.get('google_docs_link') || ''),
        website_link: String(data.get('website_link') || ''),
        file_url: fileUrl,
        additional_notes: String(data.get('additional_notes') || ''),
      })
      if (insertErr) throw insertErr
      onSubmitted()
    } catch (err) {
      logError('[SubmissionModal] submission failed:', err)
      setError(getErrorMessage(err, 'Something went wrong submitting your work — please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-squircle border border-white/10 bg-panel p-7 relative max-h-[85vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white">
          <X size={18} />
        </button>
        <h3 className="font-display font-semibold text-lg mb-1">Submit your work</h3>
        <p className="text-white/40 text-xs mb-5">{application.bounties?.title}</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input name="github_repo" placeholder="GitHub Repository" className="input" />
          <input name="x_post_link" placeholder="X Post Link" className="input" />
          <input name="google_docs_link" placeholder="Google Docs Link" className="input" />
          <input name="website_link" placeholder="Website" className="input" />
          <label className="input flex items-center gap-3 cursor-pointer">
            <UploadCloud size={16} className="text-white/40 shrink-0" />
            <span className="text-white/50 text-sm truncate">{file ? file.name : 'Attach a file (optional)'}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <textarea name="additional_notes" rows={3} placeholder="Additional notes" className="input resize-y" />
          {error && <div className="text-xs text-rose-300">{error}</div>}
          <button type="submit" disabled={submitting} className="mt-1 px-5 py-3 rounded-full font-semibold bg-gradient-to-br from-purple-glow to-purple disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit Work'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
