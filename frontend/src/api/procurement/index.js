import axios, { API_ORIGIN } from '../client'

const BASE = `${API_ORIGIN}/api/erp`

export const getSuppliers = async (params = {}) => (await axios.get(`${BASE}/procurement/suppliers`, { params })).data
export const createSupplier = async (data) => (await axios.post(`${BASE}/procurement/suppliers`, data)).data
export const updateSupplier = async (id, data) => (await axios.put(`${BASE}/procurement/suppliers/${id}`, data)).data
export const deleteSupplier = async (id) => (await axios.delete(`${BASE}/procurement/suppliers/${id}`)).data

export const getPurchaseOrders = async (params = {}) => (await axios.get(`${BASE}/procurement/purchase-orders`, { params })).data
export const createPurchaseOrder = async (data) => (await axios.post(`${BASE}/procurement/purchase-orders`, data)).data
export const updatePurchaseOrder = async (id, data) => (await axios.put(`${BASE}/procurement/purchase-orders/${id}`, data)).data
export const deletePurchaseOrder = async (id) => (await axios.delete(`${BASE}/procurement/purchase-orders/${id}`)).data

export const getProcurementDocuments = async (params = {}) => (await axios.get(`${BASE}/procurement/documents`, { params })).data
export const uploadProcurementDocument = async (data) => (await axios.post(`${BASE}/procurement/documents`, data)).data
export const deleteProcurementDocument = async (id) => (await axios.delete(`${BASE}/procurement/documents/${id}`)).data

export const getExpiryAlerts = async (params = {}) => (await axios.get(`${BASE}/alerts/expiry`, { params })).data
export const resolveExpiryAlert = async (id, notes = '') => (
  await axios.put(`${BASE}/alerts/expiry/${id}/resolve`, { notes })
).data

export const procurementApi = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getProcurementDocuments,
  uploadProcurementDocument,
  deleteProcurementDocument,
  getExpiryAlerts,
  resolveExpiryAlert,
}

export default procurementApi
