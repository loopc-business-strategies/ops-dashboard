import { BASE, axios, getAuthConfig } from './client'

const getLedger = async (token, params) => (await axios.get(`${BASE}/ledger`, getAuthConfig(token, params))).data
const getNextJvDocNo = async (token, referenceType) => (await axios.get(`${BASE}/ledger/next-voucher-no`, getAuthConfig(token, { referenceType }))).data
const createLedgerEntry = async (token, payload) => (await axios.post(`${BASE}/ledger`, payload, getAuthConfig(token))).data
const createJournalVoucherBatch = async (token, payload) =>
  (await axios.post(`${BASE}/ledger/journal-voucher`, payload, getAuthConfig(token))).data
const createBankJvEntry = async (_token, formData) => (await axios.post(`${BASE}/ledger`, formData, { withCredentials: true })).data
const updateLedgerEntry = async (token, id, payload) => (await axios.put(`${BASE}/ledger/${id}`, payload, getAuthConfig(token))).data
const deleteLedgerEntry = async (token, id) => (await axios.delete(`${BASE}/ledger/${id}`, getAuthConfig(token))).data
const reconcileLedgerEntry = async (token, id) => (await axios.put(`${BASE}/ledger/${id}/reconcile`, {}, getAuthConfig(token))).data

/** Finance: dry-run count of legacy JV rows that would get FC + rate (see backend docs). */
const repairJvFxPreview = async (token, body = {}) =>
  (await axios.post(`${BASE}/ledger/repair-jv-fx/preview`, body, getAuthConfig(token))).data

/** Finance + destructive confirm: persist FC + exchangeRate on legacy journal/bank_jv rows. */
const repairJvFxApply = async (token, body = {}) =>
  (await axios.post(`${BASE}/ledger/repair-jv-fx/apply`, body, getAuthConfig(token))).data

export const ledgerApi = {
  getLedger,
  getNextJvDocNo,
  createLedgerEntry,
  createJournalVoucherBatch,
  createBankJvEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  reconcileLedgerEntry,
  repairJvFxPreview,
  repairJvFxApply,
}
