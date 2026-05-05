import axios from 'axios'

const API_ORIGIN = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || '') : ''
const BASE = `${API_ORIGIN}/api/department-state`

const getDepartmentState = async (_token, module) =>
  (await axios.get(`${BASE}/${module}`)).data

const saveDepartmentState = async (_token, module, state) =>
  (await axios.put(`${BASE}/${module}`, { state })).data

const departmentStateAPI = {
  getDepartmentState,
  saveDepartmentState,
}

export default departmentStateAPI
