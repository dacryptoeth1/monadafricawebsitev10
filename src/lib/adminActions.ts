type ShowToast = (msg: string) => void

interface RunAdminActionOptions {
  // Shown on success, if provided. Omit for actions where the caller
  // wants to show its own more specific success message instead.
  successMessage?: string
  // If set, a window.confirm() prompt gates the action — returns false
  // without calling `action` at all if the user cancels.
  confirmMessage?: string
}

// Every admin mutation in this app is either a `.rpc(...)` call or a
// Supabase query-builder call (`.update().eq(...)`, `.insert(...)`,
// `.delete().eq(...)`) — both resolve to `{ data, error }` when awaited.
// Note: these builders are "thenable" (awaitable) but not real Promise
// instances, so the param type here is PromiseLike (just needs
// `.then()`), not Promise.
// This wraps that call so every admin panel reports failures the same
// way instead of each one hand-rolling its own try/catch/toast (or,
// in several places before this, no error handling at all).
export async function runAdminAction<T>(
  action: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  showToast: ShowToast,
  options: RunAdminActionOptions = {},
): Promise<boolean> {
  if (options.confirmMessage && !window.confirm(options.confirmMessage)) return false

  try {
    const { error } = await action()
    if (error) {
      showToast(error.message)
      return false
    }
    if (options.successMessage) showToast(options.successMessage)
    return true
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Something went wrong')
    return false
  }
}
