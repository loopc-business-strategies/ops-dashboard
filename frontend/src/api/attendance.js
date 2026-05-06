import axios from 'axios'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const BASE = `${API_ORIGIN}/api/attendance`

const getSummary = async (_token, date) =>
  (await axios.get(`${BASE}/summary`, { params: { date } })).data

const getRecords = async (_token, params = {}) =>
  (await axios.get(`${BASE}/records`, { params })).data

const markRecord = async (_token, data) =>
  (await axios.post(`${BASE}/records`, data)).data

const getMyAttendance = async (_token) =>
  (await axios.get(`${BASE}/me`)).data

const getLeaveRequests = async (_token, status = 'all') =>
  (await axios.get(`${BASE}/leave`, { params: { status } })).data

const createLeaveRequest = async (_token, data) =>
  (await axios.post(`${BASE}/leave`, data)).data

const reviewLeaveRequest = async (_token, id, data) =>
  (await axios.put(`${BASE}/leave/${id}/decision`, data)).data

const attendanceAPI = {
  getSummary,
  getRecords,
  markRecord,
  getMyAttendance,
  getLeaveRequests,
  createLeaveRequest,
  reviewLeaveRequest,
}

export default attendanceAPI
