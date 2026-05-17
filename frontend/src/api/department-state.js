import axios, { API_ORIGIN } from './client'

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
