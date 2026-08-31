import { useEffect, useMemo, useRef, useState } from 'react'
import { Country } from 'country-state-city'
import { ChevronDown, Search } from 'lucide-react'

export interface CountryOption {
  isoCode: string
  name: string
  flag: string
}

const ALL_COUNTRIES: CountryOption[] = Country.getAllCountries()
  .map((c) => ({ isoCode: c.isoCode, name: c.name, flag: c.flag }))
  .sort((a, b) => a.name.localeCompare(b.name))

export default function CountrySelect({
  value,
  onChange,
  required,
}: {
  value: string // isoCode
  onChange: (isoCode: string, name: string) => void
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = ALL_COUNTRIES.find((c) => c.isoCode === value)

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_COUNTRIES
    const q = query.toLowerCase()
    return ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q))
  }, [query])

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
        onChange(pick.isoCode, pick.name)
        setOpen(false)
        setQuery('')
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input w-full flex items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <span>{selected.flag}</span>
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-white/30">Select a country{required && ' *'}</span>
          )}
        </span>
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
              placeholder="Search countries…"
              className="bg-transparent outline-none text-sm w-full placeholder-white/25"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-white/40 text-sm">No matches.</div>
            ) : (
              filtered.map((c, i) => (
                <button
                  type="button"
                  key={c.isoCode}
                  onClick={() => {
                    onChange(c.isoCode, c.name)
                    setOpen(false)
                    setQuery('')
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left ${
                    i === highlight ? 'bg-purple/20 text-white' : 'text-white/70'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
