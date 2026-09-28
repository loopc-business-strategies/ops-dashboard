import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor/fm-calls`

/** Open "Call F.M" alerts raised from the MG Floor tablet — MG tenant session required. */
export const mgFloorFmCallsApi = {
  list: async () => (await axios.get(BASE)).data,
  acknowledge: async (id) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/acknowledge`, {})).data,
}
