import type { LucideIcon } from 'lucide-react'

interface ActionLink {
  label: string
  href: string
  external?: boolean
}

export default function EmptyState({
  Icon,
  message,
  action,
  actions,
}: {
  Icon: LucideIcon
  message: string
  action?: ActionLink
  actions?: ActionLink[]
}) {
  const allActions = actions ?? (action ? [action] : [])
  return (
    <div className="col-span-full border border-dashed border-white/15 rounded-squircle py-16 px-8 text-center bg-white/[0.02]">
      <div className="w-11 h-11 mx-auto mb-4 rounded-xl bg-purple/10 border border-purple/25 flex items-center justify-center">
        <Icon size={18} className="text-purple-light" />
      </div>
      <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed whitespace-pre-line">{message}</p>
      {allActions.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-center mt-5">
          {allActions.map((a) =>
            a.external ? (
              <a
                key={a.label}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-full text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
              >
                {a.label}
              </a>
            ) : (
              <a
                key={a.label}
                href={a.href}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-br from-purple-glow to-purple"
              >
                {a.label}
              </a>
            ),
          )}
        </div>
      )}
    </div>
  )
}
