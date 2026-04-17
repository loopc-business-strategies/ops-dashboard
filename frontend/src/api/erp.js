import axios from 'axios'

const BASE = '/api/erp'
const h = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

// Inventory
const getInventory = async (token, params = {}) => (await axios.get(`${BASE}/inventory`, { params, ...h(token) })).data
const createInventoryItem = async (token, data) => (await axios.post(`${BASE}/inventory`, data, h(token))).data
const updateInventoryItem = async (token, id, data) => (await axios.put(`${BASE}/inventory/${id}`, data, h(token))).data
const deleteInventoryItem = async (token, id) => (await axios.delete(`${BASE}/inventory/${id}`, h(token))).data
const getInventoryMovements = async (token) => (await axios.get(`${BASE}/inventory/movements`, h(token))).data

// Suppliers
const getSuppliers = async (token) => (await axios.get(`${BASE}/procurement/suppliers`, h(token))).data
const createSupplier = async (token, data) => (await axios.post(`${BASE}/procurement/suppliers`, data, h(token))).data
const updateSupplier = async (token, id, data) => (await axios.put(`${BASE}/procurement/suppliers/${id}`, data, h(token))).data
const deleteSupplier = async (token, id) => (await axios.delete(`${BASE}/procurement/suppliers/${id}`, h(token))).data

// Purchase Orders
const getPurchaseOrders = async (token, params = {}) => (await axios.get(`${BASE}/procurement/purchase-orders`, { params, ...h(token) })).data
const createPurchaseOrder = async (token, data) => (await axios.post(`${BASE}/procurement/purchase-orders`, data, h(token))).data
const updatePurchaseOrder = async (token, id, data) => (await axios.put(`${BASE}/procurement/purchase-orders/${id}`, data, h(token))).data
const deletePurchaseOrder = async (token, id) => (await axios.delete(`${BASE}/procurement/purchase-orders/${id}`, h(token))).data

// Production Work Orders
const getWorkOrders = async (token, params = {}) => (await axios.get(`${BASE}/production/work-orders`, { params, ...h(token) })).data
const createWorkOrder = async (token, data) => (await axios.post(`${BASE}/production/work-orders`, data, h(token))).data
const updateWorkOrder = async (token, id, data) => (await axios.put(`${BASE}/production/work-orders/${id}`, data, h(token))).data
const deleteWorkOrder = async (token, id) => (await axios.delete(`${BASE}/production/work-orders/${id}`, h(token))).data

// Finance Records
const getFinanceRecords = async (token, params = {}) => (await axios.get(`${BASE}/finance/records`, { params, ...h(token) })).data
const createFinanceRecord = async (token, data) => (await axios.post(`${BASE}/finance/records`, data, h(token))).data
const updateFinanceRecord = async (token, id, data) => (await axios.put(`${BASE}/finance/records/${id}`, data, h(token))).data
const deleteFinanceRecord = async (token, id) => (await axios.delete(`${BASE}/finance/records/${id}`, h(token))).data

// Procurement Documents
const getProcurementDocuments = async (token, params = {}) => (await axios.get(`${BASE}/procurement/documents`, { params, ...h(token) })).data
const uploadProcurementDocument = async (token, data) => (await axios.post(`${BASE}/procurement/documents`, data, h(token))).data
const deleteProcurementDocument = async (token, id) => (await axios.delete(`${BASE}/procurement/documents/${id}`, h(token))).data

// Expiry Alerts
const getExpiryAlerts = async (token, params = {}) => (await axios.get(`${BASE}/alerts/expiry`, { params, ...h(token) })).data
const resolveExpiryAlert = async (token, id, notes = '') => (await axios.put(`${BASE}/alerts/expiry/${id}/resolve`, { notes }, h(token))).data

const erpAPI = {
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryMovements,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  getFinanceRecords,
  createFinanceRecord,
  updateFinanceRecord,
  deleteFinanceRecord,
  getProcurementDocuments,
  uploadProcurementDocument,
  deleteProcurementDocument,
  getExpiryAlerts,
  resolveExpiryAlert,
}

export default erpAPI
