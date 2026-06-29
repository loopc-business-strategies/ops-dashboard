import axios, { API_ORIGIN } from '../client'

const BASE = `${API_ORIGIN}/api/erp/inventory`

export const getInventory = async (params = {}) => (await axios.get(BASE, { params })).data
export const createInventoryItem = async (data) => (await axios.post(BASE, data)).data
export const updateInventoryItem = async (id, data) => (await axios.put(`${BASE}/${id}`, data)).data
export const deleteInventoryItem = async (id) => (await axios.delete(`${BASE}/${id}`)).data
export const getInventoryMovements = async (params = {}) => (
  await axios.get(`${API_ORIGIN}/api/erp/inventory/movements`, { params })
).data

export const inventoryApi = {
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getInventoryMovements,
}

export default inventoryApi
