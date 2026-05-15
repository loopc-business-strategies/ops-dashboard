import { BASE, axios, getAuthConfig } from './client'

const getLedger = async (token, params) => (await axios.get(`${BASE}/ledger`, getAuthConfig(token, params))).data
const createLedgerEntry = async (token, payload) => (await axios.post(`${BASE}/ledger`, payload, getAuthConfig(token))).data
const createBankJvEntry = async (_token, formData) => (await axios.post(`${BASE}/ledger`, formData, { withCredentials: true })).data
const updateLedgerEntry = async (token, id, payload) => (await axios.put(`${BASE}/ledger/${id}`, payload, getAuthConfig(token))).data
const deleteLedgerEntry = async (token, id) => (await axios.delete(`${BASE}/ledger/${id}`, getAuthConfig(token))).data
const reconcileLedgerEntry = async (token, id) => (await axios.put(`${BASE}/ledger/${id}/reconcile`, {}, getAuthConfig(token))).data

export const ledgerApi = {
  getLedger,
  createLedgerEntry,
  createBankJvEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  reconcileLedgerEntry,
}
