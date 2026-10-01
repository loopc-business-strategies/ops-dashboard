import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor/batch-entries`

/** MG Floor Metal In / Out batches waiting for Floor Manager approval — MG tenant session required. */
export const mgFloorBatchEntriesApi = {
  list: async (params) => (await axios.get(BASE, { params })).data,
  approve: async (id) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/approve`, {})).data,
  reject: async (id, reason) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/reject`, { reason })).data,
  /** Re-applies approved batches to the Operations → Production workbook. */
  syncWorkbook: async () => (await axios.post(`${BASE}/sync-workbook`, {})).data,
  /** Loss warning limit per department, e.g. { melting: 0.5 }. */
  lossLimits: async () => (await axios.get(`${API_ORIGIN}/api/mg-floor/batch-stats/loss-limits`)).data,
  /** Every department's limit, who set it, and its last 30 days of loss (managers only). */
  lossLimitSettings: async () => (await axios.get(`${API_ORIGIN}/api/mg-floor/batch-stats/loss-limit-settings`)).data,
  /** Sets a department's loss limit %, or removes it with null. */
  setLossLimit: async (department, lossLimitPct) =>
    (await axios.put(`${API_ORIGIN}/api/mg-floor/batch-stats/loss-limit`, { department, lossLimitPct })).data,
  /** Average finished batch time in minutes per department, e.g. { melting: 150 }. */
  timeAverages: async () => (await axios.get(`${API_ORIGIN}/api/mg-floor/batch-stats/time-averages`)).data,
  /** Manager assigned on the tablets per department, e.g. { melting: { id, name } }. */
  departmentManagers: async () => (await axios.get(`${API_ORIGIN}/api/mg-floor/department-managers`)).data,
}
