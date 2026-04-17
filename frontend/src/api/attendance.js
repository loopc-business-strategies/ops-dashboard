import axios from 'axios'

const BASE = '/api/attendance'
const h = (token) => ({ headers: { Authorization: `Bearer ${token}` } })

const getSummary = async (token, date) =>
  (await axios.get(`${BASE}/summary`, { params: { date }, ...h(token) })).data

const getRecords = async (token, params = {}) =>
  (await axios.get(`${BASE}/records`, { params, ...h(token) })).data

const markRecord = async (token, data) =>
  (await axios.post(`${BASE}/records`, data, h(token))).data

const getMyAttendance = async (token) =>
  (await axios.get(`${BASE}/me`, h(token))).data

const getLeaveRequests = async (token, status = 'all') =>
  (await axios.get(`${BASE}/leave`, { params: { status }, ...h(token) })).data

const createLeaveRequest = async (token, data) =>
  (await axios.post(`${BASE}/leave`, data, h(token))).data

const reviewLeaveRequest = async (token, id, data) =>
  (await axios.put(`${BASE}/leave/${id}/decision`, data, h(token))).data

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
