import axios from 'axios'
import { installCsrfInterceptor } from '../utils/csrfInterceptor'
import { setLastApiError } from '../utils/lastApiError'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000)

axios.defaults.withCredentials = true
axios.defaults.timeout = Number.isFinite(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0 ? API_TIMEOUT_MS : 20000
installCsrfInterceptor(axios)

const applyCsrfTokenFromResponse = (response) => {
  const raw = response?.data?.csrfToken
  if (typeof raw !== 'string') return
  const next = raw.trim()
  if (!next) return
  axios.defaults.headers.common['x-csrf-token'] = next
}

axios.interceptors.response.use((response) => {
  applyCsrfTokenFromResponse(response)
  return response
})

const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504])
const RETRYABLE_METHODS = new Set(['get', 'head', 'options'])
const MAX_RETRIES = 2

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config
    const status = Number(error?.response?.status || 0)
    const bodyMsg = String(error?.response?.data?.message || '')
    const isCsrf403 = status === 403 && /csrf validation failed/i.test(bodyMsg)

    // One retry: session cookie can be newer than the in-memory x-csrf-token (e.g. after refresh, or
    // cross-host cookie confusion). GET /auth/me returns the token matching the current cookie.
    if (isCsrf403 && config && !config.__csrfResyncAttempted) {
      config.__csrfResyncAttempted = true
      try {
        const { default: authAPI } = await import('./auth.js')
        const data = await authAPI.getMe()
        if (data?.csrfToken) {
          axios.defaults.headers.common['x-csrf-token'] = String(data.csrfToken).trim()
        }
        return axios.request(config)
      } catch {
        // fall through — surface original error
      }
    }

    if (!config || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error)
    }

    const method = String(config.method || 'get').toLowerCase()
    const shouldRetry = RETRYABLE_METHODS.has(method)
      && (RETRYABLE_STATUS.has(status) || !error.response)

    if (!shouldRetry) {
      if (error?.response && Number(error.response.status) >= 400) {
        setLastApiError(error)
      }
      return Promise.reject(error)
    }

    config.__retryCount = Number(config.__retryCount || 0) + 1
    const delayMs = 300 * (2 ** (config.__retryCount - 1))
    await new Promise((resolve) => { setTimeout(resolve, delayMs) })
    return axios.request(config)
  },
)

const apiUrl = (path) => {
  const normalizedPath = String(path || '').startsWith('/') ? path : `/${path || ''}`
  return `${API_ORIGIN}${normalizedPath}`
}

const withAuth = (params = null) => {
  const config = { withCredentials: true }
  if (params) config.params = params
  return config
}

export {
  API_ORIGIN,
  apiUrl,
  withAuth,
}

export default axios
