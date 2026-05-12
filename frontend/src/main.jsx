// FILE: src/main.jsx
// This is the very first file React runs.
// It finds the <div id="root"> in index.html and renders the app inside it.

import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App'
import { installCsrfInterceptor } from './utils/csrfInterceptor'
import './index.css'

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

installCsrfInterceptor(axios)

axios.interceptors.request.use((config) => {
  if (config?.url) {
    config.url = rewriteTenantLocalhostApiUrl(config.url)
  }
  return config
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
