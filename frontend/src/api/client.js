import axios from 'axios'
import { installCsrfInterceptor } from '../utils/csrfInterceptor'
import { setLastApiError } from '../utils/lastApiError'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

axios.defaults.withCredentials = true
installCsrfInterceptor(axios)

const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504])
const RETRYABLE_METHODS = new Set(['get', 'head', 'options'])
const MAX_RETRIES = 2

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config
    if (!config || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error)
    }

    const method = String(config.method || 'get').toLowerCase()
    const status = Number(error?.response?.status || 0)
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
