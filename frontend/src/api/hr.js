// FILE: src/api/hr.js
// API calls for HR employee records.

import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/hr/employees`

const getEmployees = async (_token, opts = {}) => {
  const params = {}
  if (opts.asOf) params.asOf = opts.asOf
  if (opts.activeOnly) params.activeOnly = '1'
  if (opts.page) params.page = opts.page
  if (opts.limit) params.limit = opts.limit
  return (await axios.get(BASE, { params })).data
}
const getEmployee = async (_token, id, opts = {}) => {
  const params = {}
  if (opts.includeArchived) params.includeArchived = '1'
  return (await axios.get(`${BASE}/${id}`, { params })).data
}
const getNextEmployeeCode = async (_token) => (await axios.get(`${BASE}/next-code`)).data
const createEmployee = async (_token, data) => (await axios.post(BASE, data)).data
const updateEmployee = async (_token, id, data) => (await axios.put(`${BASE}/${id}`, data)).data
const deleteEmployee = async (_token, id) => (await axios.delete(`${BASE}/${id}`)).data
const reactivateEmployee = async (_token, id) => (await axios.post(`${BASE}/${id}/reactivate`)).data
const setRebateCollected = async (_token, id, data) =>
  (await axios.patch(`${BASE}/${id}/rebate-collected`, data)).data
const getSalaryAssignment = async (_token, id) => (await axios.get(`${BASE}/${id}/salary-assignment`)).data
const putSalaryAssignment = async (_token, id, data) => (await axios.put(`${BASE}/${id}/salary-assignment`, data)).data
const getEmployeeRemarks = async (_token, id) => (await axios.get(`${BASE}/${id}/remarks`)).data
const addEmployeeRemark = async (_token, id, data) => (await axios.post(`${BASE}/${id}/remarks`, data)).data

const hrAPI = {
  getEmployees,
  getEmployee,
  getNextEmployeeCode,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  reactivateEmployee,
  setRebateCollected,
  getSalaryAssignment,
  putSalaryAssignment,
  getEmployeeRemarks,
  addEmployeeRemark,
}
export default hrAPI
