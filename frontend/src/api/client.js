import axios from 'axios'
import { installCsrfInterceptor } from '../utils/csrfInterceptor'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

axios.defaults.withCredentials = true
installCsrfInterceptor(axios)

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
