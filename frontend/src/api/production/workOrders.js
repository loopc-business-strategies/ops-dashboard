import axios, { API_ORIGIN } from '../client'

const BASE = `${API_ORIGIN}/api/erp/production/work-orders`

export const getWorkOrders = async (params = {}) => (await axios.get(BASE, { params })).data
export const createWorkOrder = async (data) => (await axios.post(BASE, data)).data
export const updateWorkOrder = async (id, data) => (await axios.put(`${BASE}/${id}`, data)).data
export const deleteWorkOrder = async (id) => (await axios.delete(`${BASE}/${id}`)).data

export const workOrdersApi = {
  getWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
}

export default workOrdersApi
