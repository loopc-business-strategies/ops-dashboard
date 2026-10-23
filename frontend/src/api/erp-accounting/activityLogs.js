import { BASE, axios, getAuthConfig } from './client'

const getActivityLogs = async (token, params = {}) =>
  (await axios.get(`${BASE}/activity-logs`, getAuthConfig(token, params))).data

export const activityLogsApi = {
  getActivityLogs,
}
