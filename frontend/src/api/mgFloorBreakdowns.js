import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/mg-floor/breakdowns`

/** Open Breakdowns reported from MG Floor tablets — Floor / Production Managers only. */
export const mgFloorBreakdownsApi = {
  list: async () => (await axios.get(BASE)).data,
  acknowledge: async (id) => (await axios.post(`${BASE}/${encodeURIComponent(id)}/acknowledge`, {})).data,
}
