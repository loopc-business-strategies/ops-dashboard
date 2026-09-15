import axios, { API_ORIGIN } from './client'

const BASE = `${API_ORIGIN}/api/erp/production-control`

const inflight = new Map()

function cacheKey(method, path, params) {
  return `${method}:${path}:${JSON.stringify(params || {})}`
}

const get = async (path, params, config = {}) => {
  const key = cacheKey('GET', path, params)
  if (!config.signal && inflight.has(key)) {
    return inflight.get(key)
  }
  const promise = axios.get(`${BASE}${path}`, { params, signal: config.signal })
    .then((r) => r.data)
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key)
    })
  if (!config.signal) inflight.set(key, promise)
  return promise
}

const post = async (path, body) => (await axios.post(`${BASE}${path}`, body || {})).data
const put = async (path, body) => (await axios.put(`${BASE}${path}`, body || {})).data
const patch = async (path, body) => (await axios.patch(`${BASE}${path}`, body || {})).data

export const productionControlApi = {
  me: (config) => get('/me', undefined, config),
  getFlow: (config) => get('/flow', undefined, config),
  updateFlow: (body) => put('/flow', body),
  getLiveFloor: (config) => get('/live-floor', undefined, config),
  getLiveFloorSummary: (config) => get('/live-floor/summary', undefined, config),
  getLiveFloorBoard: (config) => get('/live-floor/board', undefined, config),
  getLiveFloorAlerts: (config) => get('/live-floor/alerts', undefined, config),
  getLiveFloorCustody: (config) => get('/live-floor/custody', undefined, config),
  getLiveFloorActivity: (config) => get('/live-floor/activity', undefined, config),
  getLiveFloorWidgets: (config) => get('/live-floor/widgets', undefined, config),
  search: (params, config) => get('/search', params, config),
  listBatches: (params, config) => get('/batches', params, config),
  getBatch: (id, params, config) => get(`/batches/${id}`, params, config),
  createBatch: (body) => post('/batches', body),
  issueFromVault: (id, body) => post(`/batches/${id}/issue-from-vault`, body),
  holdBatch: (id, body) => post(`/batches/${id}/hold`, body),
  releaseBatch: (id, body) => post(`/batches/${id}/release`, body),
  returnToVault: (id, body) => post(`/batches/${id}/return-to-vault`, body),
  adjustWeight: (id, body) => post(`/batches/${id}/weight-adjustments`, body),
  splitBatch: (id, body) => post(`/batches/${id}/split`, body),
  mergeBatches: (body) => post('/batches/merge', body),
  listPasses: (params, config) => get('/passes', params, config),
  createPass: (body) => post('/passes', body),
  approvePass: (id) => post(`/passes/${id}/approve`),
  issuePass: (id, body) => post(`/passes/${id}/issue`, body),
  receivePass: (id, body) => post(`/passes/${id}/receive`, body),
  cancelPass: (id, body) => post(`/passes/${id}/cancel`, body),
  listMovements: (params, config) => get('/movements', params, config),
  listProcesses: (params, config) => get('/processes', params, config),
  startProcess: (body) => post('/processes/start', body),
  completeProcess: (id, body) => post(`/processes/${id}/complete`, body),
  listQc: (params, config) => get('/qc', params, config),
  submitQc: (body) => post('/qc', body),
  listMachines: (config) => get('/machines', undefined, config),
  createMachine: (body) => post('/machines', body),
  updateMachineStatus: (id, body) => patch(`/machines/${id}/status`, body),
  updateMachine: (id, body) => patch(`/machines/${id}`, body),
  listAlerts: (params, config) => get('/alerts', params, config),
  raiseAlert: (body) => post('/alerts', body),
  acknowledgeAlert: (id) => post(`/alerts/${id}/acknowledge`),
  resolveAlert: (id) => post(`/alerts/${id}/resolve`),
  listAudit: (config) => get('/audit', undefined, config),
  getWorkOrdersSummary: (config) => get('/work-orders-summary', undefined, config),
  getMyTasks: (config) => get('/my-tasks', undefined, config),

  getMetalCustody: (params, config) => get('/metal-custody', params, config),
  getDelays: (params, config) => get('/delays', params, config),
  getReworkQueue: (params, config) => get('/rework-queue', params, config),

  getStockOverview: (config) => get('/stock/overview', undefined, config),
  listStock: (params, config) => get('/stock', params, config),
  getStock: (id, config) => get(`/stock/${id}`, undefined, config),
  getStockHistory: (params, config) => get('/stock/history', params, config),
  createStock: (body) => post('/stock', body),
  updateStock: (id, body) => patch(`/stock/${id}`, body),
  markStockAvailable: (id, body) => post(`/stock/${id}/available`, body),
  selectStock: (body) => post('/stock/select', body),
  adjustStock: (id, body) => post(`/stock/${id}/adjust`, body),
  dispatchStock: (id, body) => post(`/stock/${id}/dispatch`, body),

  listDepartments: (config) => get('/departments', undefined, config),
  getDepartment: (key, config) => get(`/departments/${key}`, undefined, config),
  listShifts: (config) => get('/shifts', undefined, config),
  getCurrentShift: (config) => get('/shifts/current', undefined, config),
  upsertShift: (body) => post('/shifts', body),
  floorLogin: (body) => post('/floor-sessions/login', body),
  floorLogout: (body) => post('/floor-sessions/logout', body),
  floorHeartbeat: () => post('/floor-sessions/heartbeat'),
  listFloorSessions: (params, config) => get('/floor-sessions', params, config),
  reportDaily: (params, config) => get('/reports/daily', params, config),
  reportStockMovement: (params, config) => get('/reports/stock-movement', params, config),
  reportDepartmentPerformance: (params, config) => get('/reports/department-performance', params, config),
  reportQc: (params, config) => get('/reports/qc', params, config),
  reportShift: (params, config) => get('/reports/shift', params, config),
  reportMetalCustody: (params, config) => get('/reports/metal-custody', params, config),
  reportWeightVariance: (params, config) => get('/reports/weight-variance', params, config),
  reportMachinePerformance: (params, config) => get('/reports/machine-performance', params, config),
  getTraceability: (params, config) => get('/traceability', params, config),

  listMaintenance: (params, config) => get('/maintenance', params, config),
  createMaintenance: (body) => post('/maintenance', body),
  updateMaintenance: (id, body) => patch(`/maintenance/${id}`, body),
  completeMaintenance: (id, body) => post(`/maintenance/${id}/complete`, body),
  evaluateMaintenanceOverdue: () => post('/maintenance/evaluate-overdue'),
}

export default productionControlApi
