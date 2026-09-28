import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor/batch-entries`

/** MG Floor Metal In / Out batches waiting for Floor Manager approval — MG tenant session required. */
export const mgFloorBatchEntriesApi = {
  list: async (params) => (await axios.get(BASE, { params })).data,
  approve: async (id) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/approve`, {})).data,
  reject: async (id, reason) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/reject`, { reason })).data,
  /** Re-applies approved batches to the Operations → Production workbook. */
  syncWorkbook: async () => (await axios.post(`${BASE}/sync-workbook`, {})).data,
}
