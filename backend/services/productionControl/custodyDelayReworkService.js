/**
 * Additive read APIs for Metal Custody, Delay Monitor, and Rework queue.
 * Composes existing collections — no new required schema fields.
 */
const ProductionBatch = require('../../models/ProductionBatch')
const ProcessRun = require('../../models/ProcessRun')
const QcInspection = require('../../models/QcInspection') // tenant model: QcInspection
const { ACTIVE_BATCH_STATUSES, DEFAULT_ALERT_THRESHOLDS } = require('./constants')
const { ensureDefaultFlowConfig } = require('./flowConfigService')

const VAULT_STATUSES = ['CREATED', 'AWAITING_ISSUE', 'RETURNED_TO_VAULT']
const TRANSIT_STATUSES = ['IN_TRANSIT', 'ISSUED']
const QC_STATUSES = ['QC', 'QC_FAILED']
const HOLD_STATUSES = ['HOLD']
const FINISHED_STATUSES = ['COMPLETED']
const WIP_STATUSES = ACTIVE_BATCH_STATUSES.filter(
  (s) => ![...VAULT_STATUSES, ...TRANSIT_STATUSES, ...QC_STATUSES, ...HOLD_STATUSES].includes(s),
)

function hoursAgo(hours) {
  return new Date(Date.now() - Number(hours || 0) * 60 * 60 * 1000)
}

function elapsedHours(fromDate) {
  if (!fromDate) return 0
  return Math.max(0, (Date.now() - new Date(fromDate).getTime()) / (60 * 60 * 1000))
}

async function getMetalCustody(query = {}) {
  const filter = {}
  if (query.status) filter.status = String(query.status).trim().toUpperCase()
  if (query.department) filter.currentDepartment = new RegExp(String(query.department).trim(), 'i')
  if (query.holder) filter.currentHolderName = new RegExp(String(query.holder).trim(), 'i')
  if (query.metalType) filter.metalType = new RegExp(String(query.metalType).trim(), 'i')

  const limit = Math.min(200, Math.max(1, Number(query.limit) || 100))
  const skip = Math.max(0, Number(query.skip) || 0)

  const [batches, total, statusAgg] = await Promise.all([
    ProductionBatch.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('batchNumber status metalType purity currentWeight currentDepartment currentHolderName currentLocation currentProcess workOrderNumber stockCode updatedAt')
      .lean(),
    ProductionBatch.countDocuments(filter),
    ProductionBatch.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          weight: { $sum: '$currentWeight' },
        },
      },
    ]),
  ])

  const byStatus = Object.fromEntries(statusAgg.map((r) => [r._id, r]))
  const sumFor = (statuses) => statuses.reduce(
    (acc, s) => {
      const row = byStatus[s]
      if (!row) return acc
      return { count: acc.count + row.count, weight: acc.weight + Number(row.weight || 0) }
    },
    { count: 0, weight: 0 },
  )

  return {
    batches,
    total,
    limit,
    skip,
    totals: {
      vault: sumFor(VAULT_STATUSES),
      wip: sumFor(WIP_STATUSES),
      transit: sumFor(TRANSIT_STATUSES),
      qc: sumFor(QC_STATUSES),
      hold: sumFor(HOLD_STATUSES),
      finished: sumFor(FINISHED_STATUSES),
      rework: sumFor(['REWORK']),
    },
  }
}

async function getDelays() {
  const flow = await ensureDefaultFlowConfig()
  const thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...(flow?.alertThresholds || {}) }
  const batchHours = Number(thresholds.batchDelayedHours || 24)
  const processHours = Number(thresholds.processOverdueHours || 8)
  const batchCutoff = hoursAgo(batchHours)
  const processCutoff = hoursAgo(processHours)

  const [delayedBatches, overdueProcesses] = await Promise.all([
    ProductionBatch.find({
      status: { $in: ACTIVE_BATCH_STATUSES },
      updatedAt: { $lte: batchCutoff },
    })
      .sort({ updatedAt: 1 })
      .limit(100)
      .lean(),
    ProcessRun.find({
      status: 'IN_PROGRESS',
      startTime: { $lte: processCutoff },
    })
      .sort({ startTime: 1 })
      .limit(100)
      .lean(),
  ])

  const rows = []
  for (const b of delayedBatches) {
    rows.push({
      type: 'batch',
      batchId: b._id,
      batchNumber: b.batchNumber,
      department: b.currentDepartment || '',
      process: b.currentProcess || '',
      status: b.status,
      startedAt: b.updatedAt,
      elapsedHours: Number(elapsedHours(b.updatedAt).toFixed(2)),
      thresholdHours: batchHours,
      reason: 'Batch past delay threshold',
    })
  }
  for (const p of overdueProcesses) {
    rows.push({
      type: 'process',
      batchId: p.batchId,
      batchNumber: p.batchNumber || '',
      department: p.department || '',
      process: p.process || '',
      status: p.status,
      processRunId: p._id,
      startedAt: p.startTime,
      elapsedHours: Number(elapsedHours(p.startTime).toFixed(2)),
      thresholdHours: processHours,
      reason: 'Process past overdue threshold',
    })
  }

  rows.sort((a, b) => b.elapsedHours - a.elapsedHours)

  return {
    thresholds: { batchDelayedHours: batchHours, processOverdueHours: processHours },
    delays: rows,
    total: rows.length,
  }
}

async function getReworkQueue(query = {}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50))
  const batches = await ProductionBatch.find({ status: 'REWORK' })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean()

  const batchIds = batches.map((b) => b._id)
  const qcRows = batchIds.length
    ? await QcInspection.find({
      batchId: { $in: batchIds },
      result: { $in: ['REWORK', 'FAIL'] },
    })
      .sort({ createdAt: -1 })
      .lean()
    : []

  const qcByBatch = new Map()
  for (const q of qcRows) {
    const key = String(q.batchId)
    if (!qcByBatch.has(key)) qcByBatch.set(key, [])
    qcByBatch.get(key).push(q)
  }

  const originalIds = [...new Set(qcRows.map((q) => q.reworkOf || q.previousInspectionId).filter(Boolean))]
  const originals = originalIds.length
    ? await QcInspection.find({ _id: { $in: originalIds } }).lean()
    : []
  const originalMap = Object.fromEntries(originals.map((o) => [String(o._id), o]))

  const items = batches.map((b) => {
    const related = qcByBatch.get(String(b._id)) || []
    const latest = related[0] || null
    const priorId = latest?.reworkOf || latest?.previousInspectionId || null
    const original = priorId ? originalMap[String(priorId)] || null : null
    return {
      batchId: b._id,
      batchNumber: b.batchNumber,
      status: b.status,
      department: b.currentDepartment,
      holderName: b.currentHolderName,
      weight: b.currentWeight,
      metalType: b.metalType,
      purity: b.purity,
      workOrderNumber: b.workOrderNumber,
      updatedAt: b.updatedAt,
      latestQc: latest
        ? {
          _id: latest._id,
          inspectionNumber: latest.inspectionNumber,
          result: latest.result,
          reworkReason: latest.reworkReason || latest.failureReason || latest.remarks,
          reworkOf: latest.reworkOf || null,
          previousInspectionId: latest.previousInspectionId || null,
        }
        : null,
      originalQc: original
        ? {
          _id: original._id,
          inspectionNumber: original.inspectionNumber,
          result: original.result,
          remarks: original.remarks || original.failureReason || '',
        }
        : null,
    }
  })

  return { items, total: items.length, limit }
}

module.exports = {
  getMetalCustody,
  getDelays,
  getReworkQueue,
}
