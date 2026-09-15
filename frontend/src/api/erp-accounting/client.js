import axios, { API_ORIGIN, withAuth } from '../client'

const BASE = `${API_ORIGIN}/api/erp-accounting`

const getAuthConfig = (_token, params = null, options = {}) => withAuth(params, options)

export {
  BASE,
  axios,
  getAuthConfig,
}
