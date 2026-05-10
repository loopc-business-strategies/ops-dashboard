import { BASE, axios, getAuthConfig } from './client'

const getVendors = async (token, params) => (await axios.get(`${BASE}/vendors`, getAuthConfig(token, params))).data
const getVendorDetails = async (token, id) => (await axios.get(`${BASE}/vendors/${id}/details`, getAuthConfig(token))).data
const updateVendorWorkflow = async (token, id, payload) => (await axios.post(`${BASE}/vendors/${id}/workflow`, payload, getAuthConfig(token))).data
const getVendorDocuments = async (token, id) => (await axios.get(`${BASE}/vendors/${id}/documents`, getAuthConfig(token))).data
const addVendorDocument = async (token, id, payload) => (await axios.post(`${BASE}/vendors/${id}/documents`, payload, getAuthConfig(token))).data
const updateVendorDocument = async (token, id, documentId, payload) => (await axios.put(`${BASE}/vendors/${id}/documents/${documentId}`, payload, getAuthConfig(token))).data
const deleteVendorDocument = async (token, id, documentId) => (await axios.delete(`${BASE}/vendors/${id}/documents/${documentId}`, getAuthConfig(token))).data
const getVendorPaymentCalendar = async (token, params) => (await axios.get(`${BASE}/vendors/payment-calendar`, getAuthConfig(token, params))).data
const getVendorComplianceSummary = async (token, params) => (await axios.get(`${BASE}/vendors/compliance-summary`, getAuthConfig(token, params))).data
const getVendorOverdueAlertQueue = async (token, params) => (await axios.get(`${BASE}/vendors/alerts/overdue-queue`, getAuthConfig(token, params))).data
const createVendor = async (token, payload) => (await axios.post(`${BASE}/vendors`, payload, getAuthConfig(token))).data
const updateVendor = async (token, id, payload) => (await axios.put(`${BASE}/vendors/${id}`, payload, getAuthConfig(token))).data
const deleteVendor = async (token, id) => (await axios.delete(`${BASE}/vendors/${id}`, getAuthConfig(token))).data

export const vendorsApi = {
  getVendors,
  getVendorDetails,
  updateVendorWorkflow,
  getVendorDocuments,
  addVendorDocument,
  updateVendorDocument,
  deleteVendorDocument,
  getVendorPaymentCalendar,
  getVendorComplianceSummary,
  getVendorOverdueAlertQueue,
  createVendor,
  updateVendor,
  deleteVendor,
}