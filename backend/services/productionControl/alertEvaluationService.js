const ProductionBatch = require('../../models/ProductionBatch')
const ProcessRun = require('../../models/ProcessRun')
const ProductionStockLot = require('../../models/ProductionStockLot')
const ProductionAlert = require('../../models/ProductionAlert')
const ProductionMachine = require('../../models/ProductionMachine')
const { nextAlertNumber } = require('./numbering')
const { ACTIVE_BATCH_STATUSES, DEFAULT_ALERT_THRESHOLDS } = require('./constants')
const { getActiveFlowConfig } = require('./flowConfigService')
const { getCurrentShift } = require('./shiftService')
const { listDepartmentStatusesLite } = require('./departmentService')

/**
 * Raise a deduped alert if none open with same code+entity in last window.
 * Additive — never deletes existing alerts.
 */
async function raiseIfMissing({
  category,
  code,
  title,
  message,
  severity = 'warning',
  batchId = null,
  batchNumber = '',
  machineId = null,
  metadata = {},
}) {
  const existing = await ProductionAlert.findOne({
    code,
    status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
    ...(batchId ? { batchId } : {}),
    ...(machineId ? { machineId } : {}),
    ...(metadata.stockLotId ? { 'metadata.stockLotId': metadata.stockLotId } : {}),
    ...(metadata.department ? { 'metadata.department': metadata.department } : {}),
  }).lean()
  if (existing) return null

  const alertNumber = await nextAlertNumber(ProductionAlert)
  const [alert] = await ProductionAlert.create([
    {
      alertNumber,
      category,
      code,
      title,
      message,
      severity,
      batchId,
      batchNumber,
      machineId,
      metadata,
      raisedByName: 'system',
    },
  ])
  return alert
}

function hoursAgo(h) {
  return new Date(Date.now() - Number(h) * 3600000)
}

/**
 * Evaluate useful floor alerts using configured thresholds.
 * Called from live-floor read path; best-effort and non-destructive.
 */
async function evaluateProductionAlerts() {
  const flow = await getActiveFlowConfig()
  const t = { ...DEFAULT_ALERT_THRESHOLDS, ...(flow.alertThresholds || {}) }
  const raised = []

  // Stock waiting too long in AVAILABLE / NEW_STOCK
  const staleStock = await ProductionStockLot.find({
    status: { $in: ['NEW_STOCK', 'AVAILABLE'] },
    updatedAt: { $lte: hoursAgo(t.stockWaitingHours) },
  }).limit(20).lean()
  for (const lot of staleStock) {
    const a = await raiseIfMissing({
      category: 'stock',
      code: 'STOCK_WAITING_TOO_LONG',
      title: 'Stock waiting too long',
      message: `${lot.stockCode} in ${lot.status} since ${lot.updatedAt?.toISOString?.() || ''}`,
      severity: 'warning',
      metadata: { stockLotId: String(lot._id), stockCode: lot.stockCode },
    })
    if (a) raised.push(a)
  }

  // Batch delayed (active, not updated recently)
  const delayedBatches = await ProductionBatch.find({
    status: { $in: ACTIVE_BATCH_STATUSES },
    updatedAt: { $lte: hoursAgo(t.batchDelayedHours) },
  }).limit(20).lean()
  for (const batch of delayedBatches) {
    const a = await raiseIfMissing({
      category: 'process',
      code: 'BATCH_DELAYED',
      title: 'Batch delayed',
      message: `${batch.batchNumber} delayed in ${batch.currentDepartment || batch.status}`,
      severity: 'warning',
      batchId: batch._id,
      batchNumber: batch.batchNumber,
    })
    if (a) raised.push(a)
  }

  // Department overload
  try {
    const depts = await listDepartmentStatusesLite()
    for (const d of depts) {
      if ((d.waiting || 0) + (d.active || 0) >= Number(t.departmentOverloadJobs || 20)) {
        const a = await raiseIfMissing({
          category: 'department',
          code: 'DEPARTMENT_OVERLOADED',
          title: 'Department overloaded',
          message: `${d.label} has ${d.waiting + d.active} jobs waiting/active`,
          severity: 'warning',
          metadata: { department: d.key },
        })
        if (a) raised.push(a)
      }
    }
  } catch {
    /* ignore */
  }

  // Machine unavailable while assigned
  const badMachines = await ProductionMachine.find({
    isActive: true,
    status: { $in: ['FAULT', 'OFFLINE', 'MAINTENANCE'] },
    currentBatchId: { $ne: null },
  }).limit(20).lean()
  for (const m of badMachines) {
    const a = await raiseIfMissing({
      category: 'machine',
      code: 'MACHINE_UNAVAILABLE',
      title: 'Machine unavailable',
      message: `${m.name} (${m.machineCode}) is ${m.status} while assigned to ${m.currentBatchNumber || 'a batch'}`,
      severity: 'critical',
      machineId: m._id,
      batchId: m.currentBatchId,
      batchNumber: m.currentBatchNumber || '',
    })
    if (a) raised.push(a)
  }

  // QC pending / failed / hold (summary style — one each)
  const qcPending = await ProductionBatch.countDocuments({ status: 'QC' })
  if (qcPending > 0) {
    const a = await raiseIfMissing({
      category: 'quality',
      code: 'QC_PENDING',
      title: 'QC pending',
      message: `${qcPending} batch(es) awaiting QC action`,
      severity: 'info',
      metadata: { count: qcPending },
    })
    if (a) raised.push(a)
  }

  const onHold = await ProductionBatch.countDocuments({ status: 'HOLD' })
  if (onHold > 0) {
    const a = await raiseIfMissing({
      category: 'process',
      code: 'BATCH_ON_HOLD',
      title: 'Batch on hold',
      message: `${onHold} batch(es) currently on HOLD`,
      severity: 'warning',
      metadata: { count: onHold },
    })
    if (a) raised.push(a)
  }

  // Process overdue (IN_PROGRESS too long)
  const overdue = await ProcessRun.find({
    status: 'IN_PROGRESS',
    startTime: { $lte: hoursAgo(t.processOverdueHours) },
  }).limit(20).lean()
  for (const run of overdue) {
    const a = await raiseIfMissing({
      category: 'process',
      code: 'PROCESS_OVERDUE',
      title: 'Process overdue',
      message: `${run.process} on ${run.batchNumber} running beyond ${t.processOverdueHours}h`,
      severity: 'warning',
      batchId: run.batchId,
      batchNumber: run.batchNumber,
      metadata: { processRunId: String(run._id) },
    })
    if (a) raised.push(a)
  }

  // Packaging pending after QC pass (waiting in packing)
  const packingPending = await ProductionBatch.find({
    currentDepartment: 'packing',
    status: { $in: ['WAITING', 'RECEIVED', 'QC'] },
    updatedAt: { $lte: hoursAgo(t.packagingPendingHours) },
  }).limit(20).lean()
  for (const batch of packingPending) {
    const a = await raiseIfMissing({
      category: 'process',
      code: 'PACKAGING_PENDING',
      title: 'Packaging pending',
      message: `${batch.batchNumber} waiting in packaging`,
      severity: 'info',
      batchId: batch._id,
      batchNumber: batch.batchNumber,
    })
    if (a) raised.push(a)
  }

  // Shift ending soon
  try {
    const shift = await getCurrentShift()
    if (shift?.isCurrent && Number(shift.timeRemainingMinutes) <= Number(t.shiftEndingMinutes || 30)
      && Number(shift.timeRemainingMinutes) >= 0) {
      const a = await raiseIfMissing({
        category: 'shift',
        code: 'SHIFT_ENDING',
        title: 'Shift ending',
        message: `${shift.name} ends in ~${Math.round(shift.timeRemainingMinutes)} minutes`,
        severity: 'info',
        metadata: { shiftName: shift.name },
      })
      if (a) raised.push(a)
    }
  } catch {
    /* ignore */
  }

  return raised
}

module.exports = {
  evaluateProductionAlerts,
  raiseIfMissing,
}
