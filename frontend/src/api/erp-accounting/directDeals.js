import { BASE, axios, getAuthConfig } from './client'

const getDirectDeals = async (token, params) => (await axios.get(`${BASE}/direct-deals`, getAuthConfig(token, params))).data
const createDirectDeal = async (token, payload) => (await axios.post(`${BASE}/direct-deals`, payload, getAuthConfig(token))).data
const updateDirectDeal = async (token, id, payload) => (await axios.put(`${BASE}/direct-deals/${id}`, payload, getAuthConfig(token))).data
const deleteDirectDeal = async (token, id, reason = '') => (await axios.delete(`${BASE}/direct-deals/${id}`, {
  ...getAuthConfig(token),
  ...(reason ? { data: { reason } } : {}),
})).data

export const directDealsApi = {
  getDirectDeals,
  createDirectDeal,
  updateDirectDeal,
  deleteDirectDeal,
}