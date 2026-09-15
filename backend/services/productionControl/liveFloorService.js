const ProductionBatch = require('../../models/ProductionBatch')
const ProductionPass = require('../../models/ProductionPass')
const MetalMovement = require('../../models/MetalMovement')
const ProcessRun = require('../../models/ProcessRun')
const QcInspection = require('../../models/QcInspection')
const ProductionMachine = require('../../models/ProductionMachine')
const ProductionAlert = require('../../models/ProductionAlert')
const AuditLog = require('../../models/AuditLog')
const WeightAdjustment = require('../../models/WeightAdjustment')
const WorkOrder = require('../../models/WorkOrder')
const { ACTIVE_BATCH_STATUSES, DEFAULT_ALERT_THRESHOLDS } = require('./constants')
const { ensureDefaultFlowConfig } = require('./flowConfigService')
const { createReportResponseCache } = require('../../utils/reportResponseCache')
const { getActiveTenantKey } = require('../../db/tenantModelProxy')

const BOARD_STATUS_MAP = {
  QUEUED: ['CREATED', 'AWAITING_ISSUE', 'ISSUED', 'WAITING'],
  IN_PROGRESS: ['IN_TRANSIT', 'RECEIVED', 'IN_PROCESS'],
  PACKAGING: [],
  QC: ['QC', 'QC_FAILED'],
  REWORK: ['REWORK'],
  HOLD: ['HOLD'],
  COMPLETED: ['COMPLETED', 'RETURNED_TO_VAULT'],
}

const BOARD_SELECT = [
  '_id',
  'batchNumber',
  'stockCode',
  'workOrderNumber',
  'product',
  'metalType',
  'purity',
  'currentWeight',
  'currentDepartment',
  'status',
  'currentHolderName',
  'updatedAt',
].join(' ')

const ALERT_EVAL_TTL_MS = 5 * 60 * 1000
let lastAlertEvalAt = 0
let alertEvalInFlight = null

const liveFloorCache = createReportResponseCache(10_000)

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function scheduleAlertEvaluation() {
  const now = Date.now()
  if (now - lastAlertEvalAt < ALERT_EVAL_TTL_MS) return
  if (alertEvalInFlight) return
  lastAlertEvalAt = now
  alertEvalInFlight = Promise.resolve()
    .then(async () => {
      const { evaluateProductionAlerts } = require('./alertEvaluationService')
      await evaluateProductionAlerts()
    })
    .catch((err) => {
      console.warn('[live-floor] alert evaluation:', err.message)
    })
    .finally(() => {
      alertEvalInFlight = null
    })
}

function bucketBoard(boardBatches) {
  const board = Object.fromEntries(Object.keys(BOARD_STATUS_MAP).map((col) => [col, []]))
  for (const batch of boardBatches) {
    const dept = String(batch.currentDepartment || '').toLowerCase()
    const isPackagingLane = dept === 'packing'
      && !['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(batch.status)
    if (isPackagingLane) {
      board.PACKAGING.push(batch)
      continue
    }
    const col = Object.entries(BOARD_STATUS_MAP).find(([key, statuses]) =>
      key !== 'PACKAGING' && statuses.includes(batch.status),
    )?.[0]
    if (col) board[col].push(batch)
  }
  return board
}

async function getLiveFloorKpisCore() {
  const flow = await ensureDefaultFlowConfig()
  const today = startOfToday()
  const thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...(flow?.alertThresholds || {}) }
  const delayedCutoff = new Date(Date.now() - Number(thresholds.batchDelayedHours || 24) * 60 * 60 * 1000)

  const [
    activeBatches,
    waiting,
    qcPending,
    onHold,
    activeAlerts,
    machinesRunning,
    machinesFaulted,
    passesPending,
    metalAgg,
    metalInTransitAgg,
    delayedBatches,
    qcFailed,
    completedToday,
    returnedToday,
    activeWorkOrders,
    metalByDept,
    weightTotals,
    statusCounts,
  ] = await Promise.all([
    ProductionBatch.countDocuments({ status: { $in: ACTIVE_BATCH_STATUSES } }),
    ProductionBatch.countDocuments({ status: 'WAITING' }),
    ProductionBatch.countDocuments({ status: 'QC' }),
    ProductionBatch.countDocuments({ status: 'HOLD' }),
    ProductionAlert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] } }),
    ProductionMachine.countDocuments({ status: 'RUNNING', isActive: true }),
    ProductionMachine.countDocuments({ status: { $in: ['FAULT', 'MAINTENANCE'] }, isActive: true }),
    ProductionPass.countDocuments({ status: { $in: ['REQUESTED', 'APPROVED', 'ISSUED', 'IN_TRANSIT'] } }),
    ProductionBatch.aggregate([
      { $match: { status: { $in: ACTIVE_BATCH_STATUSES } } },
      { $group: { _id: null, total: { $sum: '$currentWeight' } } },
    ]),
    ProductionBatch.aggregate([
      { $match: { status: 'IN_TRANSIT' } },
      { $group: { _id: null, total: { $sum: '$currentWeight' }, count: { $sum: 1 } } },
    ]),
    ProductionBatch.countDocuments({
      status: { $in: ACTIVE_BATCH_STATUSES },
      updatedAt: { $lte: delayedCutoff },
    }),
    ProductionBatch.countDocuments({ status: 'QC_FAILED' }),
    ProductionBatch.countDocuments({
      status: 'COMPLETED',
      updatedAt: { $gte: today },
    }),
    ProductionBatch.countDocuments({
      status: 'RETURNED_TO_VAULT',
      updatedAt: { $gte: today },
    }),
    WorkOrder.countDocuments({
      isDeleted: { $ne: true },
      status: { $in: ['pending', 'scheduled', 'in-progress', 'in_progress', 'quality_check', 'on_hold'] },
    }).catch(() => 0),
    ProductionBatch.aggregate([
      { $match: { status: { $in: ACTIVE_BATCH_STATUSES } } },
      {
        $group: {
          _id: { department: '$currentDepartment', metalType: '$metalType' },
          weight: { $sum: '$currentWeight' },
        },
      },
    ]),
    ProductionBatch.aggregate([
      { $match: { status: { $in: [...ACTIVE_BATCH_STATUSES, 'COMPLETED', 'RETURNED_TO_VAULT'] } } },
      {
        $group: {
          _id: null,
          scrapTotal: { $sum: '$scrapWeight' },
          lossTotal: { $sum: '$lossWeight' },
          recoveredTotal: { $sum: '$recoveredWeight' },
        },
      },
    ]),
    ProductionBatch.aggregate([
      { $match: { status: { $in: [...ACTIVE_BATCH_STATUSES, 'COMPLETED', 'RETURNED_TO_VAULT'] } } },
      { $group: { _id: '$status', count: { $sum: 1 }, weight: { $sum: '$currentWeight' } } },
    ]),
  ])

  return {
    kpis: {
      activeWorkOrders,
      activeBatches,
      metalInProduction: metalAgg[0]?.total || 0,
      metalInTransit: metalInTransitAgg[0]?.total || 0,
      metalInTransitCount: metalInTransitAgg[0]?.count || 0,
      delayedBatches,
      waiting,
      qcPending,
      qcFailed,
      onHold,
      activeAlerts,
      machinesRunning,
      machinesFaulted,
      passesPending,
      completedToday,
      returnedToday,
      scrapTotal: weightTotals[0]?.scrapTotal || 0,
      lossTotal: weightTotals[0]?.lossTotal || 0,
      recoveredTotal: weightTotals[0]?.recoveredTotal || 0,
      rework: statusCounts.find((r) => r._id === 'REWORK')?.count || 0,
    },
    statusCounts: statusCounts.map((row) => ({
      status: row._id,
      count: row.count,
      weight: row.weight,
    })),
    metalByDepartment: metalByDept.map((row) => ({
      department: row._id.department,
      metalType: row._id.metalType,
      weight: row.weight,
    })),
  }
}

async function getLiveFloorSummaryPart({ bypassCache = false } = {}) {
  if (bypassCache || process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return getLiveFloorKpisCore()
  }
  const tenant = getActiveTenantKey() || 'default'
  const key = liveFloorCache.buildKey(['pcc', 'live-floor', 'summary', tenant])
  const { payload } = await liveFloorCache.getOrCompute(key, getLiveFloorKpisCore, 10_000)
  return payload
}

async function getLiveFloorBoardPart() {
  const today = startOfToday()
  const boardBatches = await ProductionBatch.find({
    $or: [
      { status: { $in: ACTIVE_BATCH_STATUSES } },
      { status: { $in: ['COMPLETED', 'RETURNED_TO_VAULT'] }, updatedAt: { $gte: today } },
    ],
  })
    .select(BOARD_SELECT)
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean()

  return {
    board: bucketBoard(boardBatches),
    activeBatches: boardBatches.slice(0, 50),
  }
}

async function getLiveFloorAlertsPart() {
  scheduleAlertEvaluation()
  const [openAlerts, activeAlerts] = await Promise.all([
    ProductionAlert.find({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    ProductionAlert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] } }),
  ])
  return {
    openAlerts,
    attention: openAlerts,
    kpis: { activeAlerts },
  }
}

async function getLiveFloorCustodyPart() {
  const custodyAgg = await ProductionBatch.aggregate([
    { $match: { status: { $in: ACTIVE_BATCH_STATUSES }, currentHolderName: { $ne: '' } } },
    {
      $group: {
        _id: {
          holder: '$currentHolderName',
          department: '$currentDepartment',
          metalType: '$metalType',
          purity: '$purity',
        },
        weight: { $sum: '$currentWeight' },
        batches: { $sum: 1 },
      },
    },
    { $sort: { weight: -1 } },
    { $limit: 40 },
  ])
  return {
    custody: custodyAgg.map((row) => ({
      person: row._id.holder,
      department: row._id.department,
      metalType: row._id.metalType,
      purity: row._id.purity,
      weight: row.weight,
      batches: row.batches,
    })),
  }
}

async function getLiveFloorActivityPart() {
  const recentMovements = await MetalMovement.find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()
  return { recentActivity: recentMovements }
}

async function getLiveFloorWidgetsPart() {
  const departmentService = require('./departmentService')
  const [
    stockOverview,
    currentShift,
    departments,
    managersPresent,
    activeOps,
  ] = await Promise.all([
    (async () => {
      try {
        return await require('./stockService').getStockOverview()
      } catch (err) {
        console.warn('[live-floor] stock overview:', err.message)
        return null
      }
    })(),
    (async () => {
      try {
        return await require('./shiftService').getCurrentShift()
      } catch (err) {
        console.warn('[live-floor] shift:', err.message)
        return null
      }
    })(),
    (async () => {
      try {
        return await departmentService.listDepartmentStatusesLite()
      } catch (err) {
        console.warn('[live-floor] departments:', err.message)
        return []
      }
    })(),
    (async () => {
      try {
        return await require('./floorSessionService').getOpenManagers()
      } catch (err) {
        console.warn('[live-floor] managers:', err.message)
        return []
      }
    })(),
    ProcessRun.find({ status: 'IN_PROGRESS' }).select('operatorName').lean().catch(() => []),
  ])

  return {
    stock: stockOverview,
    currentShift,
    departments,
    managersPresent,
    operatorsPresent: [...new Set((activeOps || []).map((o) => o.operatorName).filter(Boolean))],
  }
}

/**
 * Full live-floor payload (same shape as before). Alert eval is non-blocking.
 */
async function getLiveFloorSummary() {
  scheduleAlertEvaluation()

  const [summary, board, alerts, custody, activity, widgets] = await Promise.all([
    getLiveFloorSummaryPart({ bypassCache: true }),
    getLiveFloorBoardPart(),
    getLiveFloorAlertsPart(),
    getLiveFloorCustodyPart(),
    getLiveFloorActivityPart(),
    getLiveFloorWidgetsPart(),
  ])

  return {
    kpis: {
      ...summary.kpis,
      activeAlerts: alerts.kpis?.activeAlerts ?? summary.kpis.activeAlerts,
    },
    stock: widgets.stock,
    currentShift: widgets.currentShift,
    departments: widgets.departments,
    managersPresent: widgets.managersPresent,
    operatorsPresent: widgets.operatorsPresent,
    board: board.board,
    statusCounts: summary.statusCounts,
    activeBatches: board.activeBatches,
    custody: custody.custody,
    metalByDepartment: summary.metalByDepartment,
    attention: alerts.attention,
    openAlerts: alerts.openAlerts,
    recentActivity: activity.recentActivity,
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function searchProduction(q = {}) {
  const {
    batchNumber,
    passNumber,
    workOrder,
    employee,
    department,
    metal,
    stockCode,
    product,
    design,
    machine,
    status,
    q: freeText,
  } = q

  const search = String(freeText || q.search || '').trim()
  const batchFilter = {}
  if (batchNumber) batchFilter.batchNumber = new RegExp(escapeRegex(String(batchNumber).trim()), 'i')
  if (stockCode) batchFilter.stockCode = new RegExp(escapeRegex(String(stockCode).trim()), 'i')
  if (product) batchFilter.product = new RegExp(escapeRegex(String(product).trim()), 'i')
  if (status) batchFilter.status = String(status).trim().toUpperCase()
  if (workOrder) {
    batchFilter.$or = [
      { workOrderNumber: new RegExp(escapeRegex(String(workOrder).trim()), 'i') },
    ]
  }
  if (employee) batchFilter.currentHolderName = new RegExp(escapeRegex(String(employee).trim()), 'i')
  if (department) batchFilter.currentDepartment = new RegExp(escapeRegex(String(department).trim()), 'i')
  if (metal) batchFilter.metalType = new RegExp(escapeRegex(String(metal).trim()), 'i')
  if (machine) batchFilter.currentMachineName = new RegExp(escapeRegex(String(machine).trim()), 'i')
  if (design) batchFilter.product = new RegExp(escapeRegex(String(design).trim()), 'i')

  let batches = []
  let stockLots = []

  if (passNumber) {
    const passes = await ProductionPass.find({
      passNumber: new RegExp(escapeRegex(String(passNumber).trim()), 'i'),
    }).limit(20).lean()
    const ids = passes.map((p) => p.batchId)
    batches = await ProductionBatch.find({ _id: { $in: ids } }).limit(50).lean()
  } else if (Object.keys(batchFilter).length) {
    batches = await ProductionBatch.find(batchFilter).sort({ updatedAt: -1 }).limit(50).lean()
  } else if (search) {
    const re = new RegExp(escapeRegex(search), 'i')
    batches = await ProductionBatch.find({
      $or: [
        { batchNumber: re },
        { stockCode: re },
        { product: re },
        { workOrderNumber: re },
        { currentHolderName: re },
        { currentMachineName: re },
        { currentDepartment: re },
        { status: re },
      ],
    }).sort({ updatedAt: -1 }).limit(50).lean()
  }

  try {
    const ProductionStockLot = require('../../models/ProductionStockLot')
    const stockFilter = {}
    if (stockCode) stockFilter.stockCode = new RegExp(escapeRegex(String(stockCode).trim()), 'i')
    if (product) stockFilter.product = new RegExp(escapeRegex(String(product).trim()), 'i')
    if (design) stockFilter.designNumber = new RegExp(escapeRegex(String(design).trim()), 'i')
    if (status && !batchNumber) stockFilter.status = String(status).trim().toUpperCase()
    if (search) {
      const re = new RegExp(escapeRegex(search), 'i')
      stockLots = await ProductionStockLot.find({
        $or: [
          { stockCode: re },
          { product: re },
          { productCode: re },
          { designNumber: re },
          { batchNumber: re },
        ],
      }).limit(50).lean()
    } else if (Object.keys(stockFilter).length) {
      stockLots = await ProductionStockLot.find(stockFilter).limit(50).lean()
    }
  } catch {
    stockLots = []
  }

  return { batches, stockLots }
}

async function getBatchDetail(batchId, options = {}) {
  const include = String(options.include || 'all')
  const wantAll = include === 'all' || include === ''
  const want = (key) => wantAll || include.split(',').map((s) => s.trim()).includes(key)
  const childLimit = Math.min(200, Math.max(1, Number(options.limit) || 50))

  const batch = await ProductionBatch.findById(batchId).lean()
  if (!batch) return null

  const [movements, passes, processes, qc, adjustments, audits, alerts] = await Promise.all([
    want('movements') || want('timeline')
      ? MetalMovement.find({ batchId }).sort({ createdAt: 1 }).limit(childLimit).lean()
      : Promise.resolve([]),
    want('passes') || want('timeline')
      ? ProductionPass.find({ batchId }).sort({ createdAt: 1 }).limit(childLimit).lean()
      : Promise.resolve([]),
    want('processes') || want('timeline')
      ? ProcessRun.find({ batchId }).sort({ createdAt: 1 }).limit(childLimit).lean()
      : Promise.resolve([]),
    want('qc') || want('timeline')
      ? QcInspection.find({ batchId }).sort({ createdAt: 1 }).limit(childLimit).lean()
      : Promise.resolve([]),
    want('adjustments') || want('timeline')
      ? WeightAdjustment.find({ batchId }).sort({ createdAt: 1 }).limit(childLimit).lean()
      : Promise.resolve([]),
    want('audits')
      ? AuditLog.find({
        $or: [
          { resource: 'ProductionBatch', resourceId: batch._id },
          { 'changes.batchNumber': batch.batchNumber },
        ],
      })
        .sort({ createdAt: 1 })
        .limit(Math.min(200, childLimit))
        .lean()
      : Promise.resolve([]),
    want('alerts')
      ? ProductionAlert.find({ batchId }).sort({ createdAt: -1 }).limit(Math.min(50, childLimit)).lean()
      : Promise.resolve([]),
  ])

  let stockLot = null
  let stockEvents = []
  if (want('stock') || want('timeline')) {
    try {
      const ProductionStockLot = require('../../models/ProductionStockLot')
      const ProductionStockStatusEvent = require('../../models/ProductionStockStatusEvent')
      if (batch.stockLotId) {
        stockLot = await ProductionStockLot.findById(batch.stockLotId).lean()
        stockEvents = await ProductionStockStatusEvent.find({ stockLotId: batch.stockLotId })
          .sort({ createdAt: 1 })
          .limit(childLimit)
          .lean()
      } else if (batch.stockCode) {
        stockLot = await ProductionStockLot.findOne({ stockCode: batch.stockCode }).lean()
        if (stockLot) {
          stockEvents = await ProductionStockStatusEvent.find({ stockLotId: stockLot._id })
            .sort({ createdAt: 1 })
            .limit(childLimit)
            .lean()
        }
      }
    } catch {
      /* stock models may not be synced yet */
    }
  }

  const timeline = []
  if (want('timeline') || wantAll) {
    for (const e of stockEvents) {
      timeline.push({
        at: e.createdAt,
        type: 'stock_status',
        label: `Stock ${e.fromStatus || '—'} → ${e.toStatus}`,
        data: e,
      })
    }
    for (const p of passes) {
      timeline.push({ at: p.createdAt, type: 'pass', label: `Pass ${p.passNumber} ${p.status}`, data: p })
      if (p.issuedAt) timeline.push({ at: p.issuedAt, type: 'pass_issued', label: `Pass ${p.passNumber} issued`, data: p })
      if (p.receivedAt) timeline.push({ at: p.receivedAt, type: 'pass_received', label: `Pass ${p.passNumber} received`, data: p })
    }
    for (const m of movements) {
      timeline.push({ at: m.createdAt, type: 'movement', label: `Movement ${m.movementNumber}`, data: m })
    }
    for (const r of processes) {
      if (r.startTime) timeline.push({ at: r.startTime, type: 'process_start', label: `${r.process} started`, data: r })
      if (r.endTime) timeline.push({ at: r.endTime, type: 'process_end', label: `${r.process} completed`, data: r })
    }
    for (const q of qc) {
      timeline.push({ at: q.createdAt, type: 'qc', label: `QC ${q.result}`, data: q })
    }
    for (const a of adjustments) {
      timeline.push({ at: a.createdAt, type: 'weight', label: `Weight ${a.field} adjusted`, data: a })
    }
    timeline.sort((x, y) => new Date(x.at) - new Date(y.at))
  }

  const expectedWeight = Number(batch.initialWeight || 0) - Number(batch.lossWeight || 0)
  const actualWeight = Number(batch.currentWeight || 0)
  const difference = actualWeight - expectedWeight
  const variancePct = expectedWeight > 0 ? (Math.abs(difference) / expectedWeight) * 100 : 0

  const openPassStatuses = ['REQUESTED', 'APPROVED', 'ISSUED', 'IN_TRANSIT']
  const openPasses = passes.filter((p) => openPassStatuses.includes(p.status))
  const reservedWeight = openPasses.reduce((sum, p) => sum + Number(p.weight || 0), 0)
  const availableTransferableWeight = Math.max(0, actualWeight - reservedWeight)

  const lastMovement = movements.length ? movements[movements.length - 1] : null
  const lastPass = passes.length ? passes[passes.length - 1] : null

  return {
    batch,
    custody: {
      where: batch.currentLocation || batch.currentDepartment || null,
      department: batch.currentDepartment || null,
      holderId: batch.currentHolderId || null,
      holderName: batch.currentHolderName || null,
      weight: batch.currentWeight,
      reservedWeight,
      availableTransferableWeight,
      why: batch.currentProcess || batch.purpose || null,
      status: batch.status,
      machineId: batch.currentMachineId || null,
      machineName: batch.currentMachineName || null,
      workOrderId: batch.workOrderId || null,
      workOrderNumber: batch.workOrderNumber || null,
      process: batch.currentProcess || null,
      lastMovedAt: lastMovement?.updatedAt || lastMovement?.createdAt || lastPass?.receivedAt || lastPass?.issuedAt || null,
      lastIssuedBy: lastPass?.issuedByName || lastMovement?.issuedByName || null,
      lastReceivedBy: lastPass?.receivedByName || lastMovement?.receivedByName || null,
      fromDepartment: lastPass?.fromDepartment || lastMovement?.fromDepartment || null,
      toDepartment: lastPass?.toDepartment || lastMovement?.toDepartment || null,
      passNumber: lastPass?.passNumber || null,
      movementNumber: lastMovement?.movementNumber || null,
    },
    stockLot,
    stockEvents,
    movements,
    passes,
    processes,
    qc,
    adjustments,
    audits,
    alerts,
    timeline,
    weightReconciliation: {
      initialWeight: batch.initialWeight,
      issuedWeight: batch.issuedWeight,
      receivedWeight: batch.receivedWeight,
      processInput: batch.processInputWeight,
      processOutput: batch.processOutputWeight,
      scrap: batch.scrapWeight,
      loss: batch.lossWeight,
      recovered: batch.recoveredWeight,
      currentWeight: batch.currentWeight,
      reservedWeight,
      availableTransferableWeight,
      expectedWeight,
      actualWeight,
      difference,
      variancePct,
    },
    meta: {
      childLimit,
      include: wantAll ? 'all' : include,
      hasMoreHint: true,
    },
  }
}

async function getMyTasks(user) {
  if (!user?._id) {
    return { tasks: [], counts: { receive: 0, process: 0, qc: 0, handover: 0, total: 0 } }
  }
  const uid = user._id
  const name = String(user.name || '').trim()

  const [inboundPasses, outboundPasses, openProcesses, qcBatches, alerts] = await Promise.all([
    ProductionPass.find({
      status: { $in: ['ISSUED', 'IN_TRANSIT'] },
      $or: [{ toPersonId: uid }, ...(name ? [{ toPersonName: name }] : [])],
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
    ProductionPass.find({
      status: { $in: ['REQUESTED', 'APPROVED'] },
      $or: [{ fromPersonId: uid }, { issuedById: uid }],
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
    ProcessRun.find({
      status: 'IN_PROGRESS',
      operatorId: uid,
    })
      .sort({ startTime: -1 })
      .limit(50)
      .lean(),
    ProductionBatch.find({
      status: { $in: ['WAITING', 'QC', 'QC_FAILED'] },
      currentHolderId: uid,
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
    ProductionAlert.find({
      status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
      severity: { $in: ['critical', 'warning'] },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ])

  const tasks = []
  for (const p of inboundPasses) {
    tasks.push({
      id: `receive-${p._id}`,
      type: 'receive_pass',
      priority: 'attention',
      title: `Receive ${p.passNumber}`,
      subtitle: `${p.batchNumber || ''} · ${p.fromDepartment} → ${p.toDepartment} · ${p.weight}g`,
      passId: p._id,
      batchId: p.batchId,
      status: p.status,
    })
  }
  for (const p of outboundPasses) {
    tasks.push({
      id: `handover-${p._id}`,
      type: 'handover_pending',
      priority: 'attention',
      title: `Handover pending ${p.passNumber}`,
      subtitle: `${p.status} · ${p.fromDepartment} → ${p.toDepartment}`,
      passId: p._id,
      batchId: p.batchId,
      status: p.status,
    })
  }
  for (const r of openProcesses) {
    tasks.push({
      id: `process-${r._id}`,
      type: 'complete_process',
      priority: 'normal',
      title: `Complete ${r.process}`,
      subtitle: `${r.batchNumber || ''} · input ${r.inputWeight}g`,
      processRunId: r._id,
      batchId: r.batchId,
      status: r.status,
    })
  }
  for (const b of qcBatches) {
    tasks.push({
      id: `qc-${b._id}`,
      type: 'qc_pending',
      priority: b.status === 'QC_FAILED' ? 'critical' : 'attention',
      title: b.status === 'QC_FAILED' ? `QC failed ${b.batchNumber}` : `QC pending ${b.batchNumber}`,
      subtitle: `${b.currentDepartment || ''} · ${b.currentWeight}g`,
      batchId: b._id,
      status: b.status,
    })
  }
  for (const a of alerts.slice(0, 10)) {
    tasks.push({
      id: `alert-${a._id}`,
      type: 'alert',
      priority: a.severity === 'critical' ? 'critical' : 'attention',
      title: a.title,
      subtitle: a.message || a.alertNumber,
      alertId: a._id,
      batchId: a.batchId,
      status: a.status,
    })
  }

  const priorityRank = { critical: 0, attention: 1, normal: 2 }
  tasks.sort((x, y) => (priorityRank[x.priority] ?? 9) - (priorityRank[y.priority] ?? 9))

  return {
    tasks,
    counts: {
      receive: inboundPasses.length,
      process: openProcesses.length,
      qc: qcBatches.length,
      handover: outboundPasses.length,
      total: tasks.length,
    },
  }
}

async function getWorkOrdersSummary() {
  const rows = await ProductionBatch.aggregate([
    { $match: { workOrderId: { $ne: null } } },
    {
      $group: {
        _id: '$workOrderId',
        workOrderNumber: { $first: '$workOrderNumber' },
        batchCount: { $sum: 1 },
        activeCount: {
          $sum: {
            $cond: [{ $in: ['$status', ACTIVE_BATCH_STATUSES] }, 1, 0],
          },
        },
        metalWeight: { $sum: '$currentWeight' },
      },
    },
  ])
  return {
    byWorkOrder: rows.map((r) => ({
      workOrderId: r._id,
      workOrderNumber: r.workOrderNumber || '',
      batchCount: r.batchCount,
      activeCount: r.activeCount,
      metalWeight: r.metalWeight,
    })),
  }
}

module.exports = {
  getLiveFloorSummary,
  getLiveFloorSummaryPart,
  getLiveFloorBoardPart,
  getLiveFloorAlertsPart,
  getLiveFloorCustodyPart,
  getLiveFloorActivityPart,
  getLiveFloorWidgetsPart,
  searchProduction,
  getBatchDetail,
  getWorkOrdersSummary,
  getMyTasks,
  BOARD_STATUS_MAP,
  scheduleAlertEvaluation,
}
