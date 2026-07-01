import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/sales-ai`
const cfg = () => ({ withCredentials: true })

export const getConfig = () => axios.get(`${BASE}/config`, cfg()).then((r) => r.data)

export const getBriefing = () => axios.get(`${BASE}/briefing`, cfg()).then((r) => r.data)

export const getAutomation = () => axios.get(`${BASE}/automation`, cfg()).then((r) => r.data)

export const approveProposal = (id) => axios.post(`${BASE}/proposals/${id}/approve`, {}, cfg()).then((r) => r.data)

export const dismissProposal = (id) => axios.post(`${BASE}/proposals/${id}/dismiss`, {}, cfg()).then((r) => r.data)

export const updateAutomationSettings = (autoEnabled) => axios.patch(`${BASE}/settings`, { autoEnabled }, cfg()).then((r) => r.data)

export const chat = (payload) => axios.post(`${BASE}/chat`, payload, {
  withCredentials: true,
  timeout: 90000,
}).then((r) => r.data)
