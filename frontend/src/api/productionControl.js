import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/erp/production-control`

const get = async (path, params) => (await axios.get(`${BASE}${path}`, { params })).data
const post = async (path, body) => (await axios.post(`${BASE}${path}`, body || {})).data
const put = async (path, body) => (await axios.put(`${BASE}${path}`, body || {})).data
const patch = async (path, body) => (await axios.patch(`${BASE}${path}`, body || {})).data

export const productionControlApi = {
  me: () => get('/me'),
  getFlow: () => get('/flow'),
  updateFlow: (body) => put('/flow', body),
  getLiveFloor: () => get('/live-floor'),
  search: (params) => get('/search', params),
  listBatches: (params) => get('/batches', params),
  getBatch: (id) => get(`/batches/${id}`),
  createBatch: (body) => post('/batches', body),
  issueFromVault: (id, body) => post(`/batches/${id}/issue-from-vault`, body),
  holdBatch: (id, body) => post(`/batches/${id}/hold`, body),
  releaseBatch: (id, body) => post(`/batches/${id}/release`, body),
  returnToVault: (id, body) => post(`/batches/${id}/return-to-vault`, body),
  adjustWeight: (id, body) => post(`/batches/${id}/weight-adjustments`, body),
  listPasses: (params) => get('/passes', params),
  createPass: (body) => post('/passes', body),
  approvePass: (id) => post(`/passes/${id}/approve`),
  issuePass: (id, body) => post(`/passes/${id}/issue`, body),
  receivePass: (id, body) => post(`/passes/${id}/receive`, body),
  cancelPass: (id, body) => post(`/passes/${id}/cancel`, body),
  listMovements: (params) => get('/movements', params),
  listProcesses: (params) => get('/processes', params),
  startProcess: (body) => post('/processes/start', body),
  completeProcess: (id, body) => post(`/processes/${id}/complete`, body),
  listQc: (params) => get('/qc', params),
  submitQc: (body) => post('/qc', body),
  listMachines: () => get('/machines'),
  createMachine: (body) => post('/machines', body),
  updateMachineStatus: (id, body) => patch(`/machines/${id}/status`, body),
  listAlerts: (params) => get('/alerts', params),
  raiseAlert: (body) => post('/alerts', body),
  resolveAlert: (id) => post(`/alerts/${id}/resolve`),
  listAudit: () => get('/audit'),
  getWorkOrdersSummary: () => get('/work-orders-summary'),

  // Stock
  getStockOverview: () => get('/stock/overview'),
  listStock: (params) => get('/stock', params),
  getStock: (id) => get(`/stock/${id}`),
  getStockHistory: (params) => get('/stock/history', params),
  createStock: (body) => post('/stock', body),
  updateStock: (id, body) => patch(`/stock/${id}`, body),
  markStockAvailable: (id, body) => post(`/stock/${id}/available`, body),
  selectStock: (body) => post('/stock/select', body),
  adjustStock: (id, body) => post(`/stock/${id}/adjust`, body),

  // Departments / shifts / floor / reports
  listDepartments: () => get('/departments'),
  getDepartment: (key) => get(`/departments/${key}`),
  listShifts: () => get('/shifts'),
  getCurrentShift: () => get('/shifts/current'),
  upsertShift: (body) => post('/shifts', body),
  floorLogin: (body) => post('/floor-sessions/login', body),
  floorLogout: (body) => post('/floor-sessions/logout', body),
  floorHeartbeat: () => post('/floor-sessions/heartbeat'),
  listFloorSessions: (params) => get('/floor-sessions', params),
  reportDaily: (params) => get('/reports/daily', params),
  reportStockMovement: (params) => get('/reports/stock-movement', params),
  reportDepartmentPerformance: (params) => get('/reports/department-performance', params),
  reportQc: (params) => get('/reports/qc', params),
  reportShift: (params) => get('/reports/shift', params),
  getTraceability: (params) => get('/traceability', params),
}

export default productionControlApi
