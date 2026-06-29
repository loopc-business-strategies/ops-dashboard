import { BASE, axios, getAuthConfig } from './client'

const getTransactions = async (token, params) => (await axios.get(`${BASE}/transactions`, getAuthConfig(token, params))).data
const createTransaction = async (token, payload) => (await axios.post(`${BASE}/transactions`, payload, getAuthConfig(token))).data
const updateTransaction = async (token, id, payload) => (await axios.put(`${BASE}/transactions/${id}`, payload, getAuthConfig(token))).data
const deleteTransaction = async (token, id) => (await axios.delete(`${BASE}/transactions/${id}`, getAuthConfig(token))).data
const submitTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/submit`, payload, getAuthConfig(token))).data
const approveTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/approve`, payload, getAuthConfig(token))).data
const returnTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/return`, payload, getAuthConfig(token))).data
const rejectTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/reject`, payload, getAuthConfig(token))).data
const postTransaction = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/post`, payload, getAuthConfig(token))).data
const addTransactionComment = async (token, id, payload) => (await axios.post(`${BASE}/transactions/${id}/comments`, payload, getAuthConfig(token))).data
const uploadTransactionAttachment = async (_token, id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return (await axios.post(`${BASE}/transactions/${id}/attachments`, formData, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data
}
const deleteTransactionAttachment = async (token, id, attachmentId) => (await axios.delete(`${BASE}/transactions/${id}/attachments/${attachmentId}`, getAuthConfig(token))).data
const bulkTransactionAction = async (token, payload) => (await axios.post(`${BASE}/transactions/bulk-action`, payload, getAuthConfig(token))).data
const getTransactionSourceByLedger = async (token, ledgerId) => (await axios.get(`${BASE}/transactions/source-by-ledger/${ledgerId}`, getAuthConfig(token))).data
const voidTransaction = async (token, id, payload) => (await axios.post(`${BASE}/transactions/${id}/void`, payload, getAuthConfig(token))).data
const revalueFxJournal = async (token, id, payload = {}) => (await axios.post(`${BASE}/transactions/${id}/revalue-fx-journal`, payload, getAuthConfig(token))).data

export const transactionsApi = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  submitTransaction,
  approveTransaction,
  returnTransaction,
  rejectTransaction,
  postTransaction,
  addTransactionComment,
  uploadTransactionAttachment,
  deleteTransactionAttachment,
  bulkTransactionAction,
  getTransactionSourceByLedger,
  voidTransaction,
  revalueFxJournal,
}