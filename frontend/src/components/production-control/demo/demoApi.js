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
import { DEMO_WRITE_MSG } from './demoConstants'

export { DEMO_WRITE_MSG }

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
    getLiveFloorSummary: async () => {
      const floor = getDemoLiveFloor()
      return { success: true, kpis: floor.kpis, statusCounts: floor.statusCounts, metalByDepartment: floor.metalByDepartment }
    },
    getLiveFloorBoard: async () => {
      const floor = getDemoLiveFloor()
      return { success: true, board: floor.board, activeBatches: floor.activeBatches }
    },
    getLiveFloorAlerts: async () => {
      const floor = getDemoLiveFloor()
      return { success: true, openAlerts: floor.openAlerts, attention: floor.attention, kpis: { activeAlerts: floor.kpis?.activeAlerts } }
    },
    getLiveFloorCustody: async () => {
      const floor = getDemoLiveFloor()
      return { success: true, custody: floor.custody }
    },
    getLiveFloorActivity: async () => {
      const floor = getDemoLiveFloor()
      return { success: true, recentActivity: floor.recentActivity }
    },
    getLiveFloorWidgets: async () => {
      const floor = getDemoLiveFloor()
      return {
        success: true,
        stock: floor.stock,
        currentShift: floor.currentShift,
        departments: floor.departments,
        managersPresent: floor.managersPresent,
        operatorsPresent: floor.operatorsPresent,
      }
    },
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
    updateMachine: () => demoWriteOk(),
    listAlerts: async (params) => {
      const { rows, total, limit, skip } = filterList(DEMO_ALERTS, params, ['alertNumber', 'title', 'message'])
      return { success: true, alerts: rows, total, limit, skip }
    },
    raiseAlert: () => demoWriteOk(),
    acknowledgeAlert: () => demoWriteOk(),
    resolveAlert: () => demoWriteOk(),
    listAudit: async () => ({ success: true, logs: DEMO_AUDIT }),
    getMyTasks: async () => ({
      success: true,
      tasks: [
        {
          id: 'demo-recv-1',
          type: 'receive_pass',
          priority: 'attention',
          title: 'Receive PASS-DEMO-001',
          subtitle: 'vault → melting · 500g',
        },
      ],
      counts: { receive: 1, process: 0, qc: 0, handover: 0, total: 1 },
    }),
    getWorkOrdersSummary: async () => getDemoWorkOrdersSummary(),

    getMetalCustody: async () => ({
      success: true,
      batches: [],
      total: 0,
      limit: 100,
      skip: 0,
      totals: {
        vault: { count: 0, weight: 0 },
        wip: { count: 0, weight: 0 },
        transit: { count: 0, weight: 0 },
        qc: { count: 0, weight: 0 },
        hold: { count: 0, weight: 0 },
        finished: { count: 0, weight: 0 },
        rework: { count: 0, weight: 0 },
      },
    }),
    getDelays: async () => ({
      success: true,
      thresholds: { batchDelayedHours: 24, processOverdueHours: 8 },
      delays: [],
      total: 0,
    }),
    getReworkQueue: async () => ({
      success: true,
      items: [],
      total: 0,
      limit: 50,
    }),

    getStockOverview: async () => ({
      success: true,
      overview: {
        newStock: { count: 1, weight: 500 },
        available: { count: 2, weight: 1200 },
        selected: { count: 0, weight: 0 },
        underProcessing: { count: 3, weight: 2800 },
        finished: { count: 1, weight: 400 },
        dispatched: { count: 0, weight: 0 },
      },
    }),
    listStock: async () => ({ success: true, lots: [], total: 0, limit: 50, skip: 0 }),
    getStock: async () => ({ success: true, lot: null, events: [] }),
    getStockHistory: async () => ({ success: true, events: [], total: 0 }),
    createStock: () => demoWriteOk({ lot: { stockCode: 'STK-DEMO-00001', status: 'NEW_STOCK' } }),
    updateStock: () => demoWriteOk(),
    markStockAvailable: () => demoWriteOk(),
    selectStock: () => demoWriteOk({ lot: {}, batch: DEMO_BATCHES[0] }),
    adjustStock: () => demoWriteOk(),
    dispatchStock: () => demoWriteOk(),
    listDepartments: async () => ({ success: true, departments: [] }),
    getDepartment: async (key) => ({
      success: true,
      department: { key, label: key, status: 'IDLE' },
      kpis: {},
      jobs: [],
      waitingBatches: [],
      machines: [],
      alerts: [],
    }),
    listShifts: async () => ({
      success: true,
      shifts: [{ _id: 'demo-shift', name: 'Shift 1', startTime: '09:00', endTime: '21:00', isActive: true }],
      current: { name: 'Shift 1', startTime: '09:00', endTime: '21:00', startLabel: '9:00 AM', endLabel: '9:00 PM', timeElapsedMinutes: 120, timeRemainingMinutes: 600 },
    }),
    getCurrentShift: async () => ({
      success: true,
      current: { name: 'Shift 1', startTime: '09:00', endTime: '21:00', startLabel: '9:00 AM', endLabel: '9:00 PM', timeElapsedMinutes: 120, timeRemainingMinutes: 600 },
    }),
    upsertShift: () => demoWriteOk(),
    floorLogin: () => demoWriteOk({ session: { _id: 'demo', name: 'Demo', status: 'OPEN', loginAt: new Date().toISOString(), shiftName: 'Shift 1' } }),
    floorLogout: () => demoWriteOk(),
    floorHeartbeat: () => demoWriteOk(),
    listFloorSessions: async () => ({ success: true, sessions: [], total: 0 }),
    reportDaily: async () => ({ success: true, report: { summary: {} } }),
    reportStockMovement: async () => ({ success: true, report: { movements: [] } }),
    reportDepartmentPerformance: async () => ({ success: true, report: { rows: [] } }),
    reportQc: async () => ({ success: true, report: { summary: {}, rows: [] } }),
    reportShift: async () => ({ success: true, report: {} }),
    reportMetalCustody: async () => ({
      success: true,
      report: {
        summary: {
          vaultCount: null,
          vaultWeight: null,
          wipCount: null,
          transitCount: null,
          totalBatches: null,
        },
        rows: [],
      },
    }),
    reportWeightVariance: async () => ({
      success: true,
      report: {
        summary: {
          batchesReviewed: null,
          overToleranceCount: null,
          avgVariancePct: null,
          tolerancePct: null,
          totalDifference: null,
        },
        rows: [],
      },
    }),
    reportMachinePerformance: async () => ({
      success: true,
      report: {
        summary: {
          machinesActive: null,
          machinesFaultOrMaintenance: null,
          totalJobs: null,
          totalCompleted: null,
          totalWeightOut: null,
          totalRunMinutes: null,
        },
        rows: [],
      },
    }),
    getTraceability: async () => ({ success: true, report: { journey: [] } }),
    splitBatch: () => demoWriteOk({ parent: DEMO_BATCHES[0], children: [] }),
    mergeBatches: () => demoWriteOk({ merged: DEMO_BATCHES[0], parents: [] }),
    listMaintenance: async () => ({ success: true, workOrders: [] }),
    createMaintenance: () => demoWriteOk({ workOrder: { woNumber: 'PM-DEMO-00001', status: 'SCHEDULED' } }),
    updateMaintenance: () => demoWriteOk(),
    completeMaintenance: () => demoWriteOk({ workOrder: { status: 'COMPLETED' } }),
    evaluateMaintenanceOverdue: () => demoWriteOk({ alerts: [] }),
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
