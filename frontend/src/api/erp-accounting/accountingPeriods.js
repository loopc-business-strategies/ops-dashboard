import { BASE, axios, getAuthConfig } from './client'

const getAccountingPeriods = async (token, financialYear) =>
  (await axios.get(`${BASE}/accounting-periods`, getAuthConfig(token, { financialYear }))).data

const getAccountingPeriodClosingCheck = async (token, id) =>
  (await axios.get(`${BASE}/accounting-periods/${id}/closing-check`, getAuthConfig(token))).data

const closeAccountingPeriod = async (token, id, payload) =>
  (await axios.post(`${BASE}/accounting-periods/${id}/close`, payload, getAuthConfig(token))).data

const reopenAccountingPeriod = async (token, id, payload) =>
  (await axios.post(`${BASE}/accounting-periods/${id}/reopen`, payload, getAuthConfig(token))).data

export const accountingPeriodsApi = {
  getAccountingPeriods,
  getAccountingPeriodClosingCheck,
  closeAccountingPeriod,
  reopenAccountingPeriod,
}
