const RELOAD_KEY = 'ops:chunk-reload'

export function isStaleChunkError(error) {
  const message = String(error?.message || error || '')
  if (!message) return false
  return (
    /Failed to fetch dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message)
    || /error loading dynamically imported module/i.test(message)
    || /Loading chunk [\w-]+ failed/i.test(message)
    || /ChunkLoadError/i.test(message)
  )
}

/**
 * Hard-reload once per tab session to pick up a fresh index.html after deploy.
 * Returns true when a reload was triggered.
 */
export function reloadOnceForStaleChunk(storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  if (!storage) {
    if (typeof window !== 'undefined') window.location.reload()
    return true
  }
  try {
    if (storage.getItem(RELOAD_KEY) === '1') return false
    storage.setItem(RELOAD_KEY, '1')
  } catch {
    // sessionStorage may be blocked; still attempt reload
  }
  if (typeof window !== 'undefined') window.location.reload()
  return true
}

export function clearStaleChunkReloadFlag(storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null) {
  try {
    storage?.removeItem(RELOAD_KEY)
  } catch {
    // ignore
  }
}

export function installStaleChunkReloadHandlers() {
  if (typeof window === 'undefined') return

  // Clear the one-shot guard only after the shell stays up — avoids reload loops
  // if a second failure happens immediately after the first recovery attempt.
  window.setTimeout(() => {
    clearStaleChunkReloadFlag()
  }, 10_000)

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.()
    reloadOnceForStaleChunk()
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkError(event?.reason)) return
    event.preventDefault?.()
    reloadOnceForStaleChunk()
  })
}
