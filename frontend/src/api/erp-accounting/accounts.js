import { BASE, axios, getAuthConfig } from './client'

const getAccounts = async (token, params) => (await axios.get(`${BASE}/accounts`, getAuthConfig(token, params))).data
const getAccount = async (token, id) => (await axios.get(`${BASE}/accounts/${id}`, getAuthConfig(token))).data
const getAccountEnquiry = async (token, accountCode, params = {}) => (await axios.get(`${BASE}/accounts/enquiry`, getAuthConfig(token, { accountCode, ...params }))).data
const createAccount = async (token, payload) => (await axios.post(`${BASE}/accounts`, payload, getAuthConfig(token))).data
const updateAccount = async (token, id, payload) => (await axios.put(`${BASE}/accounts/${id}`, payload, getAuthConfig(token))).data
const deleteAccount = async (token, id) => (await axios.delete(`${BASE}/accounts/${id}`, getAuthConfig(token))).data

export const accountsApi = {
  getAccounts,
  getAccount,
  getAccountEnquiry,
  createAccount,
  updateAccount,
  deleteAccount,
}