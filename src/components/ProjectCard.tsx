import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, Globe, X } from 'lucide-react'
import type { EcosystemProject } from '../types'

// `onError` falls back to the initials tile instead of a broken-image
// icon if `logo_url` ever points at something unreachable — same
// reliability fix as EventCard's OrganiserLogo, so a project's icon is
// never left blank/broken even on a bad URL.
function LogoTile({ project, size = 'md' }: { project: EcosystemProject; size?: 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const dims = size === 'lg' ? 'w-16 h-16 text-lg' : 'w-12 h-12 text-sm'
  return (
    <div className={`${dims} rounded-xl bg-gradient-to-br from-purple-glow to-purple flex items-center justify-center overflow-hidden shrink-0 font-display font-bold`}>
      {project.logo_url && !failed ? (
        <img src={project.logo_url} alt={project.name} loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : (
        project.name.slice(0, 2).toUpperCase()
      )}
    </div>
  )
}

// The full project card — opens a detail modal on click (ProjectModal
// below), same click-to-open interaction as TeamMemberCard/Modal
// rather than a plain "card links straight to the website" anchor.
// Used on /ecosystem and /explore; a project with no website simply
// omits that link inside the modal instead of the card going nowhere.
export default function ProjectCard({ project }: { project: EcosystemProject }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`View ${project.name} project details`}
        className="rounded-squircle border border-white/10 bg-white/[0.02] p-6 h-full flex flex-col cursor-pointer hover:border-purple/40 hover:-translate-y-1 transition-all"
      >
        <LogoTile project={project} />
        <h3 className="font-display font-semibold text-base mt-4 mb-1">{project.name}</h3>
        {project.founder_name && <p className="text-white/40 text-xs mb-2">Founder: {project.founder_name}</p>}
        {project.description && <p className="text-white/50 text-sm leading-relaxed line-clamp-2 flex-1">{project.description}</p>}
        {project.category && (
          <span className="inline-block mt-4 w-fit text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border border-white/15 text-white/50">
            {project.category}
          </span>
        )}
      </div>

      <AnimatePresence>{open && <ProjectModal project={project} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

// Compact row variant — same click-to-open modal, sized for a dense
// list (homepage discovery grid). Mirrors TeamMemberRow's role in this
// codebase.
export function ProjectRow({ project }: { project: EcosystemProject }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } }}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={`View ${project.name} project details`}
        className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg cursor-pointer hover:bg-white/[0.03] transition-colors group"
      >
        <LogoTile project={project} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate group-hover:text-purple-light transition-colors">{project.name}</div>
          {project.founder_name ? (
            <div className="text-white/40 text-xs truncate">Founder: {project.founder_name}</div>
          ) : project.category ? (
            <div className="text-white/40 text-xs truncate">{project.category}</div>
          ) : null}
        </div>
      </div>

      <AnimatePresence>{open && <ProjectModal project={project} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

// Full project detail — same modal chrome as TeamMemberModal (backdrop
// + centered panel, portal onto document.body so a Reveal/motion
// ancestor's transform can't clip a fixed backdrop to one grid cell).
// Exported so other project-card-shaped surfaces (e.g. Home.tsx's
// "Live across the ecosystem" highlight card) can open the exact same
// modal on click instead of duplicating it or falling back to a plain
// outbound link.
export function ProjectModal({ project, onClose }: { project: EcosystemProject; onClose: () => void }) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-squircle border border-white/10 bg-panel p-7 relative max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name} — project details`}
      >
        <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white" aria-label="Close">
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center">
          <LogoTile project={project} size="lg" />
          <h3 className="font-display font-semibold text-xl mt-4 uppercase tracking-wide">{project.name}</h3>
          {project.category && <p className="text-purple-light text-sm font-medium mt-1">{project.category}</p>}
          {project.country && <p className="text-white/40 text-xs mt-1">{project.country}</p>}

          {project.description && (
            <div className="mt-5 text-left w-full">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">About</span>
              <p className="text-white/60 text-sm leading-relaxed mt-1.5">{project.description}</p>
            </div>
          )}

          {project.founder_name && (
            <div className="mt-5 text-left w-full">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">Founder</span>
              <p className="text-white text-sm font-medium mt-1.5">{project.founder_name}</p>
            </div>
          )}

          {/* Three distinct, clearly-labeled destinations — never the
              raw URL/handle as text: the founder's own X account, the
              PROJECT's own X account (a different handle), and the
              official website. Each only renders if that field is
              actually set, so a project missing one never shows a dead
              link. */}
          {(project.founder_x || project.project_x || project.website) && (
            <div className="w-full mt-6 pt-5 border-t border-white/10 flex flex-col gap-2.5">
              {project.founder_x && (
                <a
                  href={project.founder_x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/10 hover:border-purple/40 transition-colors"
                >
                  <span className="font-bold">𝕏</span> Founder
                </a>
              )}
              {project.project_x && (
                <a
                  href={project.project_x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-semibold border border-white/15 hover:bg-white/10 hover:border-purple/40 transition-colors"
                >
                  <span className="font-bold">𝕏</span> X Account
                </a>
              )}
              {project.website && (
                <a
                  href={project.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple hover:-translate-y-0.5 transition-transform"
                >
                  <Globe size={14} /> Website <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
