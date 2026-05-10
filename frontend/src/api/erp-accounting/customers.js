import { BASE, axios, getAuthConfig } from './client'

const getCustomers = async (token, params) => (await axios.get(`${BASE}/customers`, getAuthConfig(token, params))).data
const createCustomer = async (token, payload) => (await axios.post(`${BASE}/customers`, payload, getAuthConfig(token))).data
const updateCustomer = async (token, id, payload) => (await axios.put(`${BASE}/customers/${id}`, payload, getAuthConfig(token))).data
const deleteCustomer = async (token, id) => (await axios.delete(`${BASE}/customers/${id}`, getAuthConfig(token))).data
const getCustomerAging = async (token, id) => (await axios.get(`${BASE}/customers/${id}/aging`, getAuthConfig(token))).data

export const customersApi = {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerAging,
}