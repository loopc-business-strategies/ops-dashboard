// FILE: src/api/hr.js
// API calls for HR employee records.

import axios from 'axios'

const BASE = '/api/hr/employees'
const h = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

const getEmployees    = async (token)         => (await axios.get(BASE, h(token))).data
const createEmployee  = async (token, data)   => (await axios.post(BASE, data, h(token))).data
const updateEmployee  = async (token, id, data) => (await axios.put(`${BASE}/${id}`, data, h(token))).data
const deleteEmployee  = async (token, id)     => (await axios.delete(`${BASE}/${id}`, h(token))).data

const hrAPI = { getEmployees, createEmployee, updateEmployee, deleteEmployee }
export default hrAPI
