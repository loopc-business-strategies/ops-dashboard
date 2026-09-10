import {
  DEMO_ALERTS,
  DEMO_AUDIT,
  DEMO_BATCHES,
  DEMO_FLOW,
  DEMO_MACHINES,
  DEMO_MOVEMENTS,
  DEMO_PASSES,
  DEMO_PROCESSES,
  DEMO_QC,
  DEMO_WORK_ORDERS,
  getDemoBatchDetail,
  getDemoLiveFloor,
  getDemoWorkOrdersSummary,
} from './productionDemoData'

export const DEMO_WRITE_MSG = 'Demo mode — no production records are modified'

function demoWriteOk(extra = {}) {
  return Promise.resolve({ success: true, demo: true, message: DEMO_WRITE_MSG, ...extra })
}

function filterList(rows, params = {}, fields = []) {
  let out = [...rows]
  const search = String(params.search || params.q || '').trim().toLowerCase()
  if (search && fields.length) {
    out = out.filter((row) => fields.some((f) => String(row[f] || '').toLowerCase().includes(search)))
  }
  if (params.status) out = out.filter((r) => r.status === params.status)
  if (params.result) out = out.filter((r) => r.result === params.result)
  if (params.department) {
    out = out.filter((r) => String(r.currentDepartment || r.department || '').toLowerCase() === String(params.department).toLowerCase())
  }
  if (params.metalType) out = out.filter((r) => r.metalType === params.metalType)
  if (params.workOrderId) out = out.filter((r) => String(r.workOrderId) === String(params.workOrderId))
  if (params.batchId) out = out.filter((r) => String(r.batchId) === String(params.batchId))
  const limit = Math.min(200, Math.max(1, Number(params.limit) || 50))
  const skip = Math.max(0, Number(params.skip) || 0)
  const total = out.length
  return { rows: out.slice(skip, skip + limit), total, limit, skip }
}

/** Demo API surface — never calls axios / network. */
export function createDemoPccApi() {
  return {
    me: async () => ({ success: true, productionRole: 'demo', user: { name: 'Demo Viewer' } }),
    getFlow: async () => ({ success: true, flow: DEMO_FLOW }),
    updateFlow: () => demoWriteOk(),
    getLiveFloor: async () => getDemoLiveFloor(),
    search: async (params = {}) => {
      if (!params.passNumber && !params.batchNumber && !params.workOrder && !params.employee && !params.department && !params.metal) {
        return { success: true, batches: [] }
      }
      let batches = DEMO_BATCHES
      if (params.batchNumber) batches = batches.filter((b) => b.batchNumber.toLowerCase().includes(String(params.batchNumber).toLowerCase()))
      if (params.workOrder) batches = batches.filter((b) => String(b.workOrderNumber || '').toLowerCase().includes(String(params.workOrder).toLowerCase()))
      if (params.employee) batches = batches.filter((b) => String(b.currentHolderName || '').toLowerCase().includes(String(params.employee).toLowerCase()))
      if (params.department) batches = batches.filter((b) => String(b.currentDepartment || '').toLowerCase().includes(String(params.department).toLowerCase()))
      if (params.metal) batches = batches.filter((b) => String(b.metalType || '').toLowerCase().includes(String(params.metal).toLowerCase()))
      if (params.passNumber) {
        const passes = DEMO_PASSES.filter((p) => p.passNumber.toLowerCase().includes(String(params.passNumber).toLowerCase()))
        const nums = new Set(passes.map((p) => p.batchNumber))
        batches = DEMO_BATCHES.filter((b) => nums.has(b.batchNumber))
      }
      return { success: true, batches }
    },
    listBatches: async (params) => {
      const { rows, total, limit, skip } = filterList(DEMO_BATCHES, params, ['batchNumber', 'workOrderNumber', 'product', 'currentHolderName'])
      return { success: true, batches: rows, total, limit, skip }
    },
    getBatch: async (id) => {
      const detail = getDemoBatchDetail(id)
      if (!detail) {
        const err = new Error('Batch not found')
        err.response = { data: { message: 'Batch not found' } }
        throw err
      }
      return detail
    },
    createBatch: () => demoWriteOk({ batch: DEMO_BATCHES[0] }),
    issueFromVault: () => demoWriteOk(),
    holdBatch: () => demoWriteOk(),
    releaseBatch: () => demoWriteOk(),
    returnToVault: () => demoWriteOk(),
    adjustWeight: () => demoWriteOk(),
    listPasses: async (params) => {
      const { rows, total, limit, skip } = filterList(DEMO_PASSES, params, ['passNumber', 'batchNumber'])
      return { success: true, passes: rows, total, limit, skip }
    },
    createPass: () => demoWriteOk(),
    approvePass: () => demoWriteOk(),
    issuePass: () => demoWriteOk(),
    receivePass: () => demoWriteOk(),
    cancelPass: () => demoWriteOk(),
    listMovements: async (params) => {
      const { rows, total, limit, skip } = filterList(DEMO_MOVEMENTS, params, ['movementNumber', 'batchNumber'])
      return { success: true, movements: rows, total, limit, skip }
    },
    listProcesses: async (params) => {
      const { rows, total, limit, skip } = filterList(DEMO_PROCESSES, params, ['processNumber', 'batchNumber', 'process'])
      return { success: true, processes: rows, total, limit, skip }
    },
    startProcess: () => demoWriteOk(),
    completeProcess: () => demoWriteOk(),
    listQc: async (params) => {
      const { rows, total, limit, skip } = filterList(DEMO_QC, params, ['inspectionNumber', 'batchNumber'])
      return { success: true, inspections: rows, total, limit, skip }
    },
    submitQc: () => demoWriteOk(),
    listMachines: async () => ({ success: true, machines: DEMO_MACHINES }),
    createMachine: () => demoWriteOk(),
    updateMachineStatus: () => demoWriteOk(),
    listAlerts: async (params) => {
      const { rows, total, limit, skip } = filterList(DEMO_ALERTS, params, ['alertNumber', 'title', 'message'])
      return { success: true, alerts: rows, total, limit, skip }
    },
    raiseAlert: () => demoWriteOk(),
    resolveAlert: () => demoWriteOk(),
    listAudit: async () => ({ success: true, logs: DEMO_AUDIT }),
    getWorkOrdersSummary: async () => getDemoWorkOrdersSummary(),
  }
}

export function createDemoWorkOrdersApi() {
  return {
    getWorkOrders: async (params = {}) => {
      const page = Math.max(1, Number(params.page) || 1)
      const limit = Math.min(50, Number(params.limit) || 20)
      const search = String(params.search || '').trim().toLowerCase()
      let rows = [...DEMO_WORK_ORDERS]
      if (search) {
        rows = rows.filter((w) =>
          String(w.woNumber || '').toLowerCase().includes(search)
          || String(w.assignedTo || '').toLowerCase().includes(search)
          || String(w.product || '').toLowerCase().includes(search),
        )
      }
      if (params.status) rows = rows.filter((w) => w.status === params.status)
      if (params.stage) rows = rows.filter((w) => w.stage === params.stage)
      const total = rows.length
      const skip = (page - 1) * limit
      return {
        success: true,
        workOrders: rows.slice(skip, skip + limit),
        total,
        page,
        limit,
        permissions: { canEdit: true },
      }
    },
    createWorkOrder: () => demoWriteOk({ workOrder: DEMO_WORK_ORDERS[0] }),
    updateWorkOrder: () => demoWriteOk(),
    deleteWorkOrder: () => demoWriteOk({ message: 'Demo mode — archive not saved' }),
  }
}
