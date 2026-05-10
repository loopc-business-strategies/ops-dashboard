import { BASE, axios, getAuthConfig } from './client'

const getInventoryProducts = async (token) => (await axios.get(`${BASE}/inventory/products`, getAuthConfig(token))).data
const createInventoryProduct = async (token, payload) => (await axios.post(`${BASE}/inventory/products`, payload, getAuthConfig(token))).data
const updateInventoryProduct = async (token, id, payload) => (await axios.put(`${BASE}/inventory/products/${id}`, payload, getAuthConfig(token))).data
const deleteInventoryProduct = async (token, id) => (await axios.delete(`${BASE}/inventory/products/${id}`, getAuthConfig(token))).data
const stockInInventory = async (token, payload) => (await axios.post(`${BASE}/inventory/stock-in`, payload, getAuthConfig(token))).data
const stockOutInventory = async (token, payload) => (await axios.post(`${BASE}/inventory/stock-out`, payload, getAuthConfig(token))).data
const getStockLedger = async (token) => (await axios.get(`${BASE}/inventory/stock-ledger`, getAuthConfig(token))).data

export const inventoryApi = {
  getInventoryProducts,
  createInventoryProduct,
  updateInventoryProduct,
  deleteInventoryProduct,
  stockInInventory,
  stockOutInventory,
  getStockLedger,
}