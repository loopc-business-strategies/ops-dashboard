let lastError = null
const listeners = new Set()

export function setLastApiError(error) {
  if (!error?.response && !error?.message) return
  const status = Number(error?.response?.status || 0)
  const data = error?.response?.data
  lastError = {
    status,
    message: String(data?.message || error?.message || 'Request failed'),
    url: String(error?.config?.url || ''),
    method: String(error?.config?.method || 'get').toUpperCase(),
    at: new Date().toISOString(),
  }
  listeners.forEach((fn) => {
    try { fn(lastError) } catch { /* ignore */ }
  })
}

export function getLastApiError() {
  return lastError
}

export function clearLastApiError() {
  lastError = null
}

export function subscribeLastApiError(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
