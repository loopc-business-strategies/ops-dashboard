import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/email`
const cfg = () => ({ withCredentials: true })

export const getConnection = () => axios.get(`${BASE}/connection`, cfg()).then((r) => r.data)

export const getTenantConnection = () => axios.get(`${BASE}/tenant-connection`, cfg()).then((r) => r.data)

export const disconnect = (provider = 'gmail') => axios.delete(`${BASE}/connection`, {
  ...cfg(),
  params: { provider },
}).then((r) => r.data)

export const disconnectTenant = (provider = 'gmail') => axios.delete(`${BASE}/tenant-connection`, {
  ...cfg(),
  params: { provider },
}).then((r) => r.data)

export function startGmailConnect() {
  window.location.href = `${BASE}/oauth/gmail/start`
}

export function startTenantGmailConnect() {
  window.location.href = `${BASE}/oauth/gmail/tenant/start`
}
