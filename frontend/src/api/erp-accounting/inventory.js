import { BASE, axios, getAuthConfig } from './client'

const getInventoryProducts = async (token, params = {}) => (
  await axios.get(`${BASE}/inventory/products`, getAuthConfig(token, { limit: 500, ...params }))
).data
const createInventoryProduct = async (token, payload) => (await axios.post(`${BASE}/inventory/products`, payload, getAuthConfig(token))).data
const updateInventoryProduct = async (token, id, payload) => (await axios.put(`${BASE}/inventory/products/${id}`, payload, getAuthConfig(token))).data
const deleteInventoryProduct = async (token, id) => (await axios.delete(`${BASE}/inventory/products/${id}`, getAuthConfig(token))).data
const stockInInventory = async (token, payload) => (await axios.post(`${BASE}/inventory/stock-in`, payload, getAuthConfig(token))).data
const stockOutInventory = async (token, payload) => (await axios.post(`${BASE}/inventory/stock-out`, payload, getAuthConfig(token))).data
const postAlloyMix = async (token, payload) => (await axios.post(`${BASE}/inventory/alloy-mix`, payload, getAuthConfig(token))).data
const reverseAlloyMix = async (token, payload) => (await axios.post(`${BASE}/inventory/alloy-mix/reverse`, payload, getAuthConfig(token))).data
const clearAlloyMixHistory = async (token, payload) => (
  await axios.post(`${BASE}/inventory/alloy-mix/clear-history`, payload, getAuthConfig(token))
).data
const getStockLedger = async (token, params = {}) => (
  await axios.get(`${BASE}/inventory/stock-ledger`, getAuthConfig(token, params))
).data

export const inventoryApi = {
  getInventoryProducts,
  createInventoryProduct,
  updateInventoryProduct,
  deleteInventoryProduct,
  stockInInventory,
  stockOutInventory,
  postAlloyMix,
  reverseAlloyMix,
  clearAlloyMixHistory,
  getStockLedger,
}