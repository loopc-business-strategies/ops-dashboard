import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/sales-ai`
const cfg = () => ({ withCredentials: true })

export const getConfig = () => axios.get(`${BASE}/config`, cfg()).then((r) => r.data)

export const getProfile = () => axios.get(`${BASE}/profile`, cfg()).then((r) => r.data)

export const updateProfile = (payload) => axios.put(`${BASE}/profile`, payload, cfg()).then((r) => r.data)

export const getPlaybooks = () => axios.get(`${BASE}/playbooks`, cfg()).then((r) => r.data)

export const listSessions = () => axios.get(`${BASE}/sessions`, cfg()).then((r) => r.data)

export const getSession = (id) => axios.get(`${BASE}/sessions/${id}`, cfg()).then((r) => r.data)

export const exportSession = (id) => axios.get(`${BASE}/sessions/${id}/export`, {
  ...cfg(),
  responseType: 'blob',
}).then((r) => r.data)

export const deleteSession = (id) => axios.delete(`${BASE}/sessions/${id}`, cfg()).then((r) => r.data)

export const listTasks = (params) => axios.get(`${BASE}/tasks`, { ...cfg(), params }).then((r) => r.data)

export const createTask = (payload) => axios.post(`${BASE}/tasks`, payload, cfg()).then((r) => r.data)

export const runTask = (id) => axios.post(`${BASE}/tasks/${id}/run`, {}, {
  ...cfg(),
  timeout: 120000,
}).then((r) => r.data)

export const chat = (payload) => axios.post(`${BASE}/chat`, payload, {
  withCredentials: true,
  timeout: 90000,
}).then((r) => r.data)
