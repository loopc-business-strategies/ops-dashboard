const ProductionBatch = require('../../models/ProductionBatch')
const ProcessRun = require('../../models/ProcessRun')
const QcInspection = require('../../models/QcInspection')
const ProductionStockLot = require('../../models/ProductionStockLot')
const ProductionStockStatusEvent = require('../../models/ProductionStockStatusEvent')
const ProductionFloorSession = require('../../models/ProductionFloorSession')
const ProductionPass = require('../../models/ProductionPass')
const MetalMovement = require('../../models/MetalMovement')
const WeightAdjustment = require('../../models/WeightAdjustment')
const { getCurrentShift } = require('./shiftService')
const { DEFAULT_FLOW_STAGES } = require('./constants')
const { getActiveFlowConfig } = require('./flowConfigService')
const { ProductionError } = require('./batchService')

function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

async function dailyProduction(query = {}) {
  const date = query.date ? new Date(query.date) : new Date()
  const from = startOfDay(date)
  const to = endOfDay(date)
  const shift = await getCurrentShift(date)
  const deptFilter = query.department ? { department: query.department } : {}

  const match = {
    ...deptFilter,
    $or: [
      { startTime: { $gte: from, $lte: to } },
      { endTime: { $gte: from, $lte: to } },
    ],
  }

  const [summaryRows, byDeptRows] = await Promise.all([
    ProcessRun.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          jobs: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          pending: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$status', 'COMPLETED'] }, { $ne: ['$status', 'CANCELLED'] }] },
                1,
                0,
              ],
            },
          },
          weightIn: {
            $sum: {
              $cond: [{ $eq: ['$status', 'COMPLETED'] }, { $ifNull: ['$inputWeight', 0] }, 0],
            },
          },
          weightOut: {
            $sum: {
              $cond: [{ $eq: ['$status', 'COMPLETED'] }, { $ifNull: ['$outputWeight', 0] }, 0],
            },
          },
          scrap: {
            $sum: {
              $cond: [{ $eq: ['$status', 'COMPLETED'] }, { $ifNull: ['$scrap', 0] }, 0],
            },
          },
          loss: {
            $sum: {
              $cond: [{ $eq: ['$status', 'COMPLETED'] }, { $ifNull: ['$loss', 0] }, 0],
            },
          },
        },
      },
    ]),
    ProcessRun.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$department', { $ifNull: ['$process', 'unknown'] }] },
          jobs: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          pending: {
            $sum: {
              $cond: [{ $ne: ['$status', 'COMPLETED'] }, 1, 0],
            },
          },
          weightIn: { $sum: { $ifNull: ['$inputWeight', 0] } },
          weightOut: { $sum: { $ifNull: ['$outputWeight', 0] } },
          scrap: { $sum: { $ifNull: ['$scrap', 0] } },
          loss: { $sum: { $ifNull: ['$loss', 0] } },
        },
      },
    ]),
  ])

  const summaryRow = summaryRows[0] || {
    jobs: 0, completed: 0, pending: 0, weightIn: 0, weightOut: 0, scrap: 0, loss: 0,
  }

  return {
    date: from.toISOString().slice(0, 10),
    shift: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
    summary: {
      jobs: summaryRow.jobs,
      completed: summaryRow.completed,
      pending: summaryRow.pending,
      weightIn: summaryRow.weightIn,
      weightOut: summaryRow.weightOut,
      scrap: summaryRow.scrap,
      loss: summaryRow.loss,
    },
    byDepartment: byDeptRows.map((r) => ({
      department: r._id,
      jobs: r.jobs,
      completed: r.completed,
      pending: r.pending,
      weightIn: r.weightIn,
      weightOut: r.weightOut,
      scrap: r.scrap,
      loss: r.loss,
    })),
  }
}

async function stockMovementReport(query = {}) {
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 100))
  const filter = {}
  if (query.stockCode) filter.stockCode = new RegExp(String(query.stockCode).trim(), 'i')
  if (query.fromDate || query.toDate) {
    filter.createdAt = {}
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate)
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate)
  }
  const events = await ProductionStockStatusEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  const lotIds = [...new Set(events.map((e) => String(e.stockLotId)))]
  const lots = await ProductionStockLot.find({ _id: { $in: lotIds } }).lean()
  const lotMap = Object.fromEntries(lots.map((l) => [String(l._id), l]))

  return {
    movements: events.map((e) => {
      const lot = lotMap[String(e.stockLotId)] || {}
      return {
        stockCode: e.stockCode || lot.stockCode,
        product: lot.product || '',
        from: e.fromStatus || '—',
        to: e.toStatus,
        dateTime: e.createdAt,
        user: e.actorName,
        reason: e.reason,
        batchNumber: e.batchNumber,
      }
    }),
  }
}

const { departmentRowsFromRuns } = require('./reportMath')

async function departmentPerformance(query = {}) {
  const from = query.fromDate ? startOfDay(new Date(query.fromDate)) : startOfDay(new Date(Date.now() - 7 * 86400000))
  const to = query.toDate ? endOfDay(new Date(query.toDate)) : endOfDay(new Date())
  const flow = await getActiveFlowConfig()
  const stages = (flow.stages || DEFAULT_FLOW_STAGES).filter((s) => s.process)

  // Single date-range query (was N+1 ProcessRun.find per stage) — same stage filters in memory.
  const allRuns = await ProcessRun.find({
    createdAt: { $gte: from, $lte: to },
  }).lean()

  return { from, to, rows: departmentRowsFromRuns(stages, allRuns) }
}

async function qcReport(query = {}) {
  const filter = {}
  if (query.fromDate || query.toDate) {
    filter.createdAt = {}
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate)
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate)
  }
  const inspections = await QcInspection.find(filter).sort({ createdAt: -1 }).limit(500).lean()
  const batchIds = [...new Set(inspections.map((i) => String(i.batchId)))]
  const batches = await ProductionBatch.find({ _id: { $in: batchIds } }).lean()
  const batchMap = Object.fromEntries(batches.map((b) => [String(b._id), b]))

  const summary = { PASS: 0, FAIL: 0, HOLD: 0, REWORK: 0 }
  const rows = inspections.map((i) => {
    summary[i.result] = (summary[i.result] || 0) + 1
    const batch = batchMap[String(i.batchId)] || {}
    return {
      batch: i.batchNumber,
      stock: i.stockCode || batch.stockCode || '',
      product: batch.product || '',
      result: i.result,
      inspector: i.inspectorName,
      date: i.createdAt,
      remarks: i.remarks,
      failureReason: i.failureReason,
      reworkReason: i.reworkReason,
    }
  })
  return { summary, rows }
}

async function shiftReport(query = {}) {
  const date = query.date ? new Date(query.date) : new Date()
  const from = startOfDay(date)
  const to = endOfDay(date)
  const shift = await getCurrentShift(date)

  const [sessions, processes, qc, holds] = await Promise.all([
    ProductionFloorSession.find({ loginAt: { $gte: from, $lte: to } }).lean(),
    ProcessRun.find({
      $or: [
        { startTime: { $gte: from, $lte: to } },
        { endTime: { $gte: from, $lte: to } },
      ],
    }).lean(),
    QcInspection.find({ createdAt: { $gte: from, $lte: to } }).lean(),
    ProductionBatch.countDocuments({ status: 'HOLD' }),
  ])

  const operators = [...new Set(processes.map((p) => p.operatorName).filter(Boolean))]
  const managers = [...new Set(sessions.map((s) => s.name).filter(Boolean))]

  return {
    date: from.toISOString().slice(0, 10),
    shift: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
    managers,
    operators,
    production: {
      processRuns: processes.length,
      completed: processes.filter((p) => p.status === 'COMPLETED').length,
      weight: processes.reduce((s, p) => s + Number(p.outputWeight || 0), 0),
    },
    qc: {
      total: qc.length,
      pass: qc.filter((q) => q.result === 'PASS').length,
      fail: qc.filter((q) => q.result === 'FAIL').length,
      hold: qc.filter((q) => q.result === 'HOLD').length,
      rework: qc.filter((q) => q.result === 'REWORK').length,
    },
    holds,
    sessions,
  }
}

async function traceabilityReport({ stockCode, batchNumber, batchId } = {}) {
  let batch = null
  let lot = null

  if (stockCode) {
    lot = await ProductionStockLot.findOne({ stockCode: String(stockCode).toUpperCase() }).lean()
    if (lot?.batchId) batch = await ProductionBatch.findById(lot.batchId).lean()
  }
  if (!batch && batchId) batch = await ProductionBatch.findById(batchId).lean()
  if (!batch && batchNumber) {
    batch = await ProductionBatch.findOne({ batchNumber: new RegExp(`^${String(batchNumber).trim()}$`, 'i') }).lean()
  }
  if (!lot && batch?.stockLotId) {
    lot = await ProductionStockLot.findById(batch.stockLotId).lean()
  }
  if (!lot && batch?.stockCode) {
    lot = await ProductionStockLot.findOne({ stockCode: batch.stockCode }).lean()
  }

  if (!batch && !lot) throw new ProductionError('Stock or batch not found', 404)

  const bid = batch?._id
  const [events, processes, passes, movements, qc, adjustments] = await Promise.all([
    lot
      ? ProductionStockStatusEvent.find({ stockLotId: lot._id }).sort({ createdAt: 1 }).lean()
      : Promise.resolve([]),
    bid ? ProcessRun.find({ batchId: bid }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
    bid ? ProductionPass.find({ batchId: bid }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
    bid ? MetalMovement.find({ batchId: bid }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
    bid ? QcInspection.find({ batchId: bid }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
    bid ? WeightAdjustment.find({ batchId: bid }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
  ])

  const journey = []
  if (lot) {
    journey.push({
      step: 'STOCK',
      label: `Stock ${lot.stockCode}`,
      status: lot.status,
      at: lot.createdAt,
      data: { product: lot.product, netWeight: lot.netWeight, quantity: lot.quantity },
    })
  }
  if (batch) {
    journey.push({
      step: 'BATCH',
      label: `Batch ${batch.batchNumber}`,
      status: batch.status,
      at: batch.createdAt,
      data: { product: batch.product, weight: batch.currentWeight },
    })
  }
  for (const p of processes) {
    journey.push({
      step: 'PROCESS',
      label: p.process,
      status: p.status,
      at: p.startTime || p.createdAt,
      data: {
        inputWeight: p.inputWeight,
        outputWeight: p.outputWeight,
        scrap: p.scrap,
        loss: p.loss,
        operator: p.operatorName,
        machine: p.machineName,
        details: p.details,
      },
    })
  }
  for (const q of qc) {
    journey.push({
      step: 'QC',
      label: `QC ${q.result}`,
      status: q.result,
      at: q.createdAt,
      data: q,
    })
  }

  return {
    stock: lot,
    batch,
    stockEvents: events,
    processes,
    passes,
    movements,
    qc,
    adjustments,
    journey,
  }
}

async function metalCustodySummary(query = {}) {
  const { getMetalCustody } = require('./custodyDelayReworkService')
  const custody = await getMetalCustody(query)
  const totals = custody.totals || {}
  return {
    summary: {
      vaultCount: totals.vault?.count ?? null,
      vaultWeight: totals.vault?.weight ?? null,
      wipCount: totals.wip?.count ?? null,
      wipWeight: totals.wip?.weight ?? null,
      transitCount: totals.transit?.count ?? null,
      transitWeight: totals.transit?.weight ?? null,
      qcCount: totals.qc?.count ?? null,
      holdCount: totals.hold?.count ?? null,
      finishedCount: totals.finished?.count ?? null,
      reworkCount: totals.rework?.count ?? null,
      totalBatches: custody.total ?? null,
    },
    totals,
    rows: (custody.batches || []).map((b) => ({
      batchNumber: b.batchNumber,
      status: b.status,
      metalType: b.metalType,
      currentWeight: b.currentWeight,
      currentDepartment: b.currentDepartment,
      currentHolderName: b.currentHolderName,
      updatedAt: b.updatedAt,
    })),
  }
}

async function weightVarianceReport(query = {}) {
  const flow = await getActiveFlowConfig()
  const tolerancePct = Number(flow?.weightTolerancePct ?? 0.5)
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 100))
  const filter = {}
  if (query.status) filter.status = String(query.status).trim().toUpperCase()
  if (query.metalType) filter.metalType = new RegExp(String(query.metalType).trim(), 'i')

  const batches = await ProductionBatch.find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select('batchNumber status metalType purity initialWeight currentWeight lossWeight scrapWeight processInputWeight processOutputWeight currentDepartment updatedAt')
    .lean()

  const rows = batches.map((b) => {
    const expected = Number(b.initialWeight || 0) - Number(b.lossWeight || 0)
    const actual = Number(b.currentWeight || 0)
    const difference = actual - expected
    const variancePct = expected > 0 ? (Math.abs(difference) / expected) * 100 : 0
    return {
      batchNumber: b.batchNumber,
      status: b.status,
      metalType: b.metalType,
      department: b.currentDepartment || '',
      initialWeight: b.initialWeight,
      currentWeight: b.currentWeight,
      scrap: b.scrapWeight,
      loss: b.lossWeight,
      expectedWeight: expected,
      actualWeight: actual,
      difference,
      variancePct: Math.round(variancePct * 100) / 100,
      overTolerance: variancePct > tolerancePct,
      updatedAt: b.updatedAt,
    }
  })

  const over = rows.filter((r) => r.overTolerance)
  return {
    summary: {
      batchesReviewed: rows.length,
      overToleranceCount: over.length,
      avgVariancePct: rows.length
        ? Math.round((rows.reduce((s, r) => s + Number(r.variancePct || 0), 0) / rows.length) * 100) / 100
        : null,
      tolerancePct,
      totalDifference: rows.reduce((s, r) => s + Number(r.difference || 0), 0),
    },
    rows,
  }
}

async function machinePerformanceReport(query = {}) {
  const ProductionMachine = require('../../models/ProductionMachine')
  const from = query.fromDate ? startOfDay(new Date(query.fromDate)) : startOfDay(new Date(Date.now() - 7 * 86400000))
  const to = query.toDate ? endOfDay(new Date(query.toDate)) : endOfDay(new Date())

  const machines = await ProductionMachine.find({ isActive: true }).sort({ name: 1 }).lean()
  const runs = await ProcessRun.find({
    startTime: { $gte: from, $lte: to },
  }).lean()

  const byMachine = new Map()
  for (const r of runs) {
    const key = r.machineId ? String(r.machineId) : (r.machineName || 'unassigned')
    if (!byMachine.has(key)) {
      byMachine.set(key, { jobs: 0, completed: 0, weightIn: 0, weightOut: 0, scrap: 0, loss: 0, minutes: 0 })
    }
    const row = byMachine.get(key)
    row.jobs += 1
    if (r.status === 'COMPLETED') row.completed += 1
    row.weightIn += Number(r.inputWeight || 0)
    row.weightOut += Number(r.outputWeight || 0)
    row.scrap += Number(r.scrap || 0)
    row.loss += Number(r.loss || 0)
    if (r.startTime && r.endTime) {
      row.minutes += Math.max(0, (new Date(r.endTime) - new Date(r.startTime)) / 60000)
    }
  }

  const rows = machines.map((m) => {
    const stats = byMachine.get(String(m._id)) || byMachine.get(m.name) || {
      jobs: 0, completed: 0, weightIn: 0, weightOut: 0, scrap: 0, loss: 0, minutes: 0,
    }
    return {
      machineCode: m.machineCode,
      name: m.name,
      department: m.department || '',
      status: m.status,
      lastMaintenance: m.lastMaintenance || null,
      nextMaintenance: m.nextMaintenance || null,
      jobs: stats.jobs,
      completed: stats.completed,
      weightIn: stats.weightIn,
      weightOut: stats.weightOut,
      scrap: stats.scrap,
      loss: stats.loss,
      runMinutes: Math.round(stats.minutes * 10) / 10,
    }
  })

  const faulted = machines.filter((m) => m.status === 'FAULT' || m.status === 'MAINTENANCE').length
  return {
    from,
    to,
    summary: {
      machinesActive: machines.length,
      machinesFaultOrMaintenance: faulted,
      totalJobs: rows.reduce((s, r) => s + r.jobs, 0),
      totalCompleted: rows.reduce((s, r) => s + r.completed, 0),
      totalWeightOut: rows.reduce((s, r) => s + r.weightOut, 0),
      totalRunMinutes: rows.reduce((s, r) => s + r.runMinutes, 0),
    },
    rows,
  }
}

module.exports = {
  dailyProduction,
  stockMovementReport,
  departmentPerformance,
  qcReport,
  shiftReport,
  traceabilityReport,
  metalCustodySummary,
  weightVarianceReport,
  machinePerformanceReport,
}
