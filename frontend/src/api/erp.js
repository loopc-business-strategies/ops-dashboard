import axios from 'axios'

const BASE = '/api/erp'

// Inventory
const getInventory = async (_token, params = {}) => (await axios.get(`${BASE}/inventory`, { params })).data
const createInventoryItem = async (_token, data) => (await axios.post(`${BASE}/inventory`, data)).data
const updateInventoryItem = async (_token, id, data) => (await axios.put(`${BASE}/inventory/${id}`, data)).data
const deleteInventoryItem = async (_token, id) => (await axios.delete(`${BASE}/inventory/${id}`)).data
const getInventoryMovements = async (_token, params = {}) => (await axios.get(`${BASE}/inventory/movements`, { params })).data

// Suppliers
const getSuppliers = async (_token, params = {}) => (await axios.get(`${BASE}/procurement/suppliers`, { params })).data
const createSupplier = async (_token, data) => (await axios.post(`${BASE}/procurement/suppliers`, data)).data
const updateSupplier = async (_token, id, data) => (await axios.put(`${BASE}/procurement/suppliers/${id}`, data)).data
const deleteSupplier = async (_token, id) => (await axios.delete(`${BASE}/procurement/suppliers/${id}`)).data

// Purchase Orders
const getPurchaseOrders = async (_token, params = {}) => (await axios.get(`${BASE}/procurement/purchase-orders`, { params })).data
const createPurchaseOrder = async (_token, data) => (await axios.post(`${BASE}/procurement/purchase-orders`, data)).data
const updatePurchaseOrder = async (_token, id, data) => (await axios.put(`${BASE}/procurement/purchase-orders/${id}`, data)).data
const deletePurchaseOrder = async (_token, id) => (await axios.delete(`${BASE}/procurement/purchase-orders/${id}`)).data

// Production Work Orders
const getWorkOrders = async (_token, params = {}) => (await axios.get(`${BASE}/production/work-orders`, { params })).data
const createWorkOrder = async (_token, data) => (await axios.post(`${BASE}/production/work-orders`, data)).data
const updateWorkOrder = async (_token, id, data) => (await axios.put(`${BASE}/production/work-orders/${id}`, data)).data
const deleteWorkOrder = async (_token, id) => (await axios.delete(`${BASE}/production/work-orders/${id}`)).data

// Finance Records
const getFinanceRecords = async (_token, params = {}) => (await axios.get(`${BASE}/finance/records`, { params })).data
const createFinanceRecord = async (_token, data) => (await axios.post(`${BASE}/finance/records`, data)).data
const updateFinanceRecord = async (_token, id, data) => (await axios.put(`${BASE}/finance/records/${id}`, data)).data
const deleteFinanceRecord = async (_token, id) => (await axios.delete(`${BASE}/finance/records/${id}`)).data

// Procurement Documents
const getProcurementDocuments = async (_token, params = {}) => (await axios.get(`${BASE}/procurement/documents`, { params })).data
const uploadProcurementDocument = async (_token, data) => (await axios.post(`${BASE}/procurement/documents`, data)).data
const deleteProcurementDocument = async (_token, id) => (await axios.delete(`${BASE}/procurement/documents/${id}`)).data

// Expiry Alerts
const getExpiryAlerts = async (_token, params = {}) => (await axios.get(`${BASE}/alerts/expiry`, { params })).data
const resolveExpiryAlert = async (_token, id, notes = '') => (await axios.put(`${BASE}/alerts/expiry/${id}/resolve`, { notes })).data

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
