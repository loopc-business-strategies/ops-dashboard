import { BASE, axios, getAuthConfig } from './client'

const getAccountingControls = async (token) =>
  (await axios.get(`${BASE}/accounting-controls`, getAuthConfig(token))).data

const updateAccountingControls = async (token, payload) =>
  (await axios.put(`${BASE}/accounting-controls`, payload, getAuthConfig(token))).data

export const accountingControlsApi = {
  getAccountingControls,
  updateAccountingControls,
}
