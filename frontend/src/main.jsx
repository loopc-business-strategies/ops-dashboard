// FILE: src/main.jsx
// This is the very first file React runs.
// It finds the <div id="root"> in index.html and renders the app inside it.

import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import axios from './api/client'
import App from './App'
import './index.css'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  const sentryRelease = String(
    import.meta.env.VITE_SENTRY_RELEASE
      || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA
      || '',
  ).trim()
  const tracesRaw = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
  const tracesSampleRate = tracesRaw === undefined || tracesRaw === ''
    ? 0
    : Math.min(1, Math.max(0, Number(tracesRaw)))
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    ...(sentryRelease ? { release: sentryRelease } : {}),
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
  })
}

const resolveTenantLocalhostUrl = (rawUrl) => {
  const input = String(rawUrl || '')
  if (!input || typeof window === 'undefined') return input

  const currentHost = String(window.location.hostname || '').toLowerCase()
  if (!currentHost.endsWith('.localhost')) return input

  try {
    const parsed = new URL(input, window.location.origin)
    const targetHost = String(parsed.hostname || '').toLowerCase()
    const isLoopbackHost = targetHost === 'localhost' || targetHost === '127.0.0.1' || targetHost === '::1'
    if (!isLoopbackHost) return input

    parsed.hostname = currentHost
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return input
  }
}

const configuredApiBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/'
axios.defaults.baseURL = resolveTenantLocalhostUrl(configuredApiBase) || '/'
axios.defaults.withCredentials = true

const rewriteTenantLocalhostApiUrl = (rawUrl) => {
  const input = String(rawUrl || '')
  if (!input) return rawUrl
  if (typeof window === 'undefined') return rawUrl
  const currentHost = String(window.location.hostname || '').toLowerCase()
  if (!currentHost.endsWith('.localhost')) return rawUrl

  try {
    const parsed = new URL(input, window.location.origin)
    const targetHost = String(parsed.hostname || '').toLowerCase()
    const isLoopbackHost = targetHost === 'localhost' || targetHost === '127.0.0.1' || targetHost === '::1'
    const isApiPath = String(parsed.pathname || '').startsWith('/api/')

    if (!isLoopbackHost || !isApiPath) return rawUrl

    parsed.hostname = currentHost
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

axios.interceptors.request.use((config) => {
  if (config?.url) {
    config.url = rewriteTenantLocalhostApiUrl(config.url)
  }
  return config
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {sentryDsn ? (
      <Sentry.ErrorBoundary
        fallback={({ error, resetError }) => (
          <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center p-6">
            <div>
              <p className="text-xl font-semibold text-white mb-2">Something went wrong</p>
              <p className="text-gray-400 text-sm mb-4 max-w-md">{error?.message || 'An unexpected error occurred.'}</p>
              <button
                type="button"
                onClick={resetError}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-500"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      >
        <App />
      </Sentry.ErrorBoundary>
    ) : (
      <App />
    )}
  </React.StrictMode>
)
