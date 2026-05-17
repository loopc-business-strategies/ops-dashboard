import axios, { API_ORIGIN, withAuth } from '../client'

const BASE = `${API_ORIGIN}/api/erp-accounting`

const getAuthConfig = (_token, params = null) => withAuth(params)

export {
  BASE,
  axios,
  getAuthConfig,
}
