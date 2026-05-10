import { BASE, axios, getAuthConfig } from './client'

const getMappings = async (token, params) => (await axios.get(`${BASE}/mappings`, getAuthConfig(token, params))).data
const createMapping = async (token, payload) => (await axios.post(`${BASE}/mappings`, payload, getAuthConfig(token))).data
const updateMapping = async (token, id, payload) => (await axios.put(`${BASE}/mappings/${id}`, payload, getAuthConfig(token))).data
const deleteMapping = async (token, id) => (await axios.delete(`${BASE}/mappings/${id}`, getAuthConfig(token))).data

export const mappingsApi = {
  getMappings,
  createMapping,
  updateMapping,
  deleteMapping,
}