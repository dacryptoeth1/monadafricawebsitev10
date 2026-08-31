import { useState, type ChangeEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Shared show/hide password input — same visual pattern already used
// on the Reset Password page (relative wrapper + absolutely-positioned
// toggle button), extracted here so Login and Signup don't each grow
// their own copy of the same toggle logic. Works either as an
// uncontrolled field (pass just `name`, read it via FormData on
// submit — matches how Signup's other fields already work) or a
// controlled one (pass `value`/`onChange` — matches how Login already
// manages its fields).
export default function PasswordField({
  label,
  name,
  required,
  autoComplete,
  value,
  onChange,
}: {
  // Omit when the caller renders its own <label> externally (e.g.
  // paired with a "Forgot password?" link) — set otherwise.
  label?: string
  name: string
  required?: boolean
  autoComplete?: string
  value?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="input pr-11 w-full"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
