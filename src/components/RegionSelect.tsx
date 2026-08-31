import { useEffect, useMemo, useRef, useState } from 'react'
import { State } from 'country-state-city'
import { ChevronDown, Search } from 'lucide-react'

export default function RegionSelect({
  countryIsoCode,
  value,
  onChange,
}: {
  countryIsoCode: string
  value: string
  onChange: (name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const regions = useMemo(() => {
    if (!countryIsoCode) return []
    return State.getStatesOfCountry(countryIsoCode).map((s) => s.name).sort((a, b) => a.localeCompare(b))
  }, [countryIsoCode])

  const filtered = useMemo(() => {
    if (!query.trim()) return regions
    const q = query.toLowerCase()
    return regions.filter((r) => r.toLowerCase().includes(q))
  }, [regions, query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setHighlight(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = filtered[highlight]
      if (pick) {
        onChange(pick)
        setOpen(false)
        setQuery('')
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (!countryIsoCode) {
    return (
      <div className="input w-full text-white/25 flex items-center justify-between">
        <span>Select a country first</span>
      </div>
    )
  }

  // Some small countries/territories have no admin-1 divisions in the
  // dataset — fall back to a free-text field rather than a dead-end dropdown.
  if (regions.length === 0) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Region / State (optional)"
        className="input w-full"
      />
    )
  }

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="input w-full flex items-center justify-between text-left">
        <span className="truncate">{value || <span className="text-white/30">Select a region / state</span>}</span>
        <ChevronDown size={14} className="text-white/40 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1.5 w-full rounded-xl border border-white/15 bg-panel shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
            <Search size={14} className="text-white/40 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search regions…"
              className="bg-transparent outline-none text-sm w-full placeholder-white/25"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-white/40 text-sm">No matches.</div>
            ) : (
              filtered.map((r, i) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => {
                    onChange(r)
                    setOpen(false)
                    setQuery('')
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full px-3 py-2 text-sm text-left truncate ${i === highlight ? 'bg-purple/20 text-white' : 'text-white/70'}`}
                >
                  {r}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
