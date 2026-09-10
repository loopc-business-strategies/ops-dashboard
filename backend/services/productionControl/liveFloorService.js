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
const { ACTIVE_BATCH_STATUSES } = require('./constants')
const { ensureDefaultFlowConfig } = require('./flowConfigService')

const BOARD_STATUS_MAP = {
  QUEUED: ['CREATED', 'AWAITING_ISSUE', 'ISSUED', 'WAITING'],
  IN_PROGRESS: ['IN_TRANSIT', 'RECEIVED', 'IN_PROCESS'],
  QC: ['QC'],
  REWORK: ['REWORK'],
  HOLD: ['HOLD'],
  COMPLETED: ['COMPLETED', 'RETURNED_TO_VAULT'],
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

async function getLiveFloorSummary() {
  await ensureDefaultFlowConfig()
  const today = startOfToday()

  const [
    activeBatches,
    waiting,
    qcPending,
    onHold,
    activeAlerts,
    machinesRunning,
    passesPending,
    metalAgg,
    recentBatches,
    custodyAgg,
    recentMovements,
    openAlerts,
    qcFailed,
    completedToday,
    returnedToday,
    activeWorkOrders,
    boardBatches,
  ] = await Promise.all([
    ProductionBatch.countDocuments({ status: { $in: ACTIVE_BATCH_STATUSES } }),
    ProductionBatch.countDocuments({ status: 'WAITING' }),
    ProductionBatch.countDocuments({ status: 'QC' }),
    ProductionBatch.countDocuments({ status: 'HOLD' }),
    ProductionAlert.countDocuments({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] } }),
    ProductionMachine.countDocuments({ status: 'RUNNING', isActive: true }),
    ProductionPass.countDocuments({ status: { $in: ['REQUESTED', 'APPROVED', 'ISSUED', 'IN_TRANSIT'] } }),
    ProductionBatch.aggregate([
      { $match: { status: { $in: ACTIVE_BATCH_STATUSES } } },
      { $group: { _id: null, total: { $sum: '$currentWeight' } } },
    ]),
    ProductionBatch.find({ status: { $in: ACTIVE_BATCH_STATUSES } })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
    ProductionBatch.aggregate([
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
    ]),
    MetalMovement.find({}).sort({ createdAt: -1 }).limit(20).lean(),
    ProductionAlert.find({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    QcInspection.countDocuments({ result: 'FAIL' }),
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
    ProductionBatch.find({
      $or: [
        { status: { $in: ACTIVE_BATCH_STATUSES } },
        { status: { $in: ['COMPLETED', 'RETURNED_TO_VAULT'] }, updatedAt: { $gte: today } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean(),
  ])

  const metalByDept = await ProductionBatch.aggregate([
    { $match: { status: { $in: ACTIVE_BATCH_STATUSES } } },
    {
      $group: {
        _id: { department: '$currentDepartment', metalType: '$metalType' },
        weight: { $sum: '$currentWeight' },
      },
    },
  ])

  const statusCounts = await ProductionBatch.aggregate([
    { $match: { status: { $in: [...ACTIVE_BATCH_STATUSES, 'COMPLETED', 'RETURNED_TO_VAULT'] } } },
    { $group: { _id: '$status', count: { $sum: 1 }, weight: { $sum: '$currentWeight' } } },
  ])

  const board = Object.fromEntries(
    Object.keys(BOARD_STATUS_MAP).map((col) => [col, []]),
  )
  for (const batch of boardBatches) {
    const col = Object.entries(BOARD_STATUS_MAP).find(([, statuses]) =>
      statuses.includes(batch.status),
    )?.[0]
    if (col) board[col].push(batch)
  }

  return {
    kpis: {
      activeWorkOrders,
      activeBatches,
      metalInProduction: metalAgg[0]?.total || 0,
      waiting,
      qcPending,
      qcFailed,
      onHold,
      activeAlerts,
      machinesRunning,
      passesPending,
      completedToday,
      returnedToday,
    },
    board,
    statusCounts: statusCounts.map((row) => ({
      status: row._id,
      count: row.count,
      weight: row.weight,
    })),
    activeBatches: recentBatches,
    custody: custodyAgg.map((row) => ({
      person: row._id.holder,
      department: row._id.department,
      metalType: row._id.metalType,
      purity: row._id.purity,
      weight: row.weight,
      batches: row.batches,
    })),
    metalByDepartment: metalByDept.map((row) => ({
      department: row._id.department,
      metalType: row._id.metalType,
      weight: row.weight,
    })),
    attention: openAlerts,
    recentActivity: recentMovements,
  }
}

async function searchProduction(q = {}) {
  const {
    batchNumber,
    passNumber,
    workOrder,
    employee,
    department,
    metal,
  } = q

  const batchFilter = {}
  if (batchNumber) batchFilter.batchNumber = new RegExp(String(batchNumber).trim(), 'i')
  if (workOrder) {
    batchFilter.$or = [
      { workOrderNumber: new RegExp(String(workOrder).trim(), 'i') },
    ]
  }
  if (employee) batchFilter.currentHolderName = new RegExp(String(employee).trim(), 'i')
  if (department) batchFilter.currentDepartment = new RegExp(String(department).trim(), 'i')
  if (metal) batchFilter.metalType = new RegExp(String(metal).trim(), 'i')

  let batches = []
  if (passNumber) {
    const passes = await ProductionPass.find({
      passNumber: new RegExp(String(passNumber).trim(), 'i'),
    }).limit(20).lean()
    const ids = passes.map((p) => p.batchId)
    batches = await ProductionBatch.find({ _id: { $in: ids } }).limit(50).lean()
  } else if (Object.keys(batchFilter).length) {
    batches = await ProductionBatch.find(batchFilter).sort({ updatedAt: -1 }).limit(50).lean()
  }

  return { batches }
}

async function getBatchDetail(batchId) {
  const batch = await ProductionBatch.findById(batchId).lean()
  if (!batch) return null

  const [movements, passes, processes, qc, adjustments, audits] = await Promise.all([
    MetalMovement.find({ batchId }).sort({ createdAt: 1 }).lean(),
    ProductionPass.find({ batchId }).sort({ createdAt: 1 }).lean(),
    ProcessRun.find({ batchId }).sort({ createdAt: 1 }).lean(),
    QcInspection.find({ batchId }).sort({ createdAt: 1 }).lean(),
    WeightAdjustment.find({ batchId }).sort({ createdAt: 1 }).lean(),
    AuditLog.find({
      $or: [
        { resource: 'ProductionBatch', resourceId: batch._id },
        { 'changes.batchNumber': batch.batchNumber },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean(),
  ])

  const timeline = []
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

  const expectedWeight = Number(batch.initialWeight || 0) - Number(batch.lossWeight || 0)
  const actualWeight = Number(batch.currentWeight || 0)
  const difference = actualWeight - expectedWeight
  const variancePct = expectedWeight > 0 ? (Math.abs(difference) / expectedWeight) * 100 : 0

  return {
    batch,
    movements,
    passes,
    processes,
    qc,
    adjustments,
    audits,
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
      expectedWeight,
      actualWeight,
      difference,
      variancePct,
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
  searchProduction,
  getBatchDetail,
  getWorkOrdersSummary,
  BOARD_STATUS_MAP,
}
