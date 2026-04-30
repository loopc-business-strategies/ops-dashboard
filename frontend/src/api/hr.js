// FILE: src/api/hr.js
// API calls for HR employee records.

import axios from 'axios'

const API_ORIGIN = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '') : ''
const BASE = `${API_ORIGIN}/api/hr/employees`

const getEmployees    = async (_token)         => (await axios.get(BASE)).data
const createEmployee  = async (_token, data)   => (await axios.post(BASE, data)).data
const updateEmployee  = async (_token, id, data) => (await axios.put(`${BASE}/${id}`, data)).data
const deleteEmployee  = async (_token, id)     => (await axios.delete(`${BASE}/${id}`)).data

const hrAPI = { getEmployees, createEmployee, updateEmployee, deleteEmployee }
export default hrAPI
