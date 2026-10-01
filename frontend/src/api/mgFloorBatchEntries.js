import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor/batch-entries`

/** MG Floor Metal In / Out batches waiting for Floor Manager approval — MG tenant session required. */
export const mgFloorBatchEntriesApi = {
  list: async (params) => (await axios.get(BASE, { params })).data,
  approve: async (id) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/approve`, {})).data,
  reject: async (id, reason) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/reject`, { reason })).data,
  /** Sends an approved batch back to the operator and takes it out of the workbook. */
  undoApproval: async (id, reason) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/undo-approval`, { reason })).data,
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
  /** Metal loss per department (or Metal Out operator) per day or month: { from, to, groupBy: 'day'|'month', department?, view?: 'department'|'operator' }. */
  lossReport: async (params) => (await axios.get(`${API_ORIGIN}/api/mg-floor/loss-report`, { params })).data,
  /** Every batch in a day range with its timeline: { from, to, department?, batch?, operator? }. */
  history: async (params) => (await axios.get(`${API_ORIGIN}/api/mg-floor/batch-history`, { params })).data,
  /** Batches the tablets saved offline and sent later: { from, to, department?, status?: 'all'|'synced'|'problem' }. */
  syncLog: async (params) => (await axios.get(`${API_ORIGIN}/api/mg-floor/sync-log`, { params })).data,
  /** Manager assigned on the tablets per department, e.g. { melting: { id, name } }. */
  departmentManagers: async () => (await axios.get(`${API_ORIGIN}/api/mg-floor/department-managers`)).data,
}
