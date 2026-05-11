import axios from 'axios'
import { installCsrfInterceptor } from '../../utils/csrfInterceptor'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const BASE = `${API_ORIGIN}/api/erp-accounting`

// Install CSRF token injection for all mutating requests
installCsrfInterceptor(axios)

const getAuthConfig = (_token, params = null) => {
  const config = {
    withCredentials: true,
  }
  if (params) config.params = params
  return config
}

export {
  BASE,
  axios,
  getAuthConfig,
}