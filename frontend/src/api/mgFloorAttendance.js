import axios, { API_ORIGIN } from './client'

/** MG Floor tablet logins / logouts — Floor and Production Managers only. */
export const mgFloorAttendanceApi = {
  /** `from` / `to`: ISO start and end of the local day to show. */
  list: async ({ from, to, limit = 500 } = {}) =>
    (await axios.get(`${API_ORIGIN}/api/mg-floor/attendance`, { params: { from, to, limit } })).data,
}
