import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/sales-ai`
const cfg = () => ({ withCredentials: true })

export const getConfig = () => axios.get(`${BASE}/config`, cfg()).then((r) => r.data)

export const chat = (payload) => axios.post(`${BASE}/chat`, payload, {
  withCredentials: true,
  timeout: 90000,
}).then((r) => r.data)
