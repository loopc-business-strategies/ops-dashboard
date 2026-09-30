import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor/fm-calls`

/** Open "Call F.M" requests from MG Floor tablets — Floor / Production Managers only. */
export const mgFloorFmCallsApi = {
  list: async () => (await axios.get(BASE)).data,
  acknowledge: async (id) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/acknowledge`, {})).data,
}
