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

  const runs = await ProcessRun.find({
    ...deptFilter,
    $or: [
      { startTime: { $gte: from, $lte: to } },
      { endTime: { $gte: from, $lte: to } },
    ],
  }).lean()

  const completed = runs.filter((r) => r.status === 'COMPLETED')
  const pending = runs.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED')

  const byDept = {}
  for (const r of runs) {
    const key = r.department || r.process || 'unknown'
    if (!byDept[key]) {
      byDept[key] = {
        department: key,
        jobs: 0,
        completed: 0,
        pending: 0,
        weightIn: 0,
        weightOut: 0,
        scrap: 0,
        loss: 0,
      }
    }
    byDept[key].jobs += 1
    if (r.status === 'COMPLETED') byDept[key].completed += 1
    else byDept[key].pending += 1
    byDept[key].weightIn += Number(r.inputWeight || 0)
    byDept[key].weightOut += Number(r.outputWeight || 0)
    byDept[key].scrap += Number(r.scrap || 0)
    byDept[key].loss += Number(r.loss || 0)
  }

  return {
    date: from.toISOString().slice(0, 10),
    shift: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
    summary: {
      jobs: runs.length,
      completed: completed.length,
      pending: pending.length,
      weightIn: completed.reduce((s, r) => s + Number(r.inputWeight || 0), 0),
      weightOut: completed.reduce((s, r) => s + Number(r.outputWeight || 0), 0),
      scrap: completed.reduce((s, r) => s + Number(r.scrap || 0), 0),
      loss: completed.reduce((s, r) => s + Number(r.loss || 0), 0),
    },
    byDepartment: Object.values(byDept),
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

async function departmentPerformance(query = {}) {
  const from = query.fromDate ? startOfDay(new Date(query.fromDate)) : startOfDay(new Date(Date.now() - 7 * 86400000))
  const to = query.toDate ? endOfDay(new Date(query.toDate)) : endOfDay(new Date())
  const flow = await getActiveFlowConfig()
  const stages = (flow.stages || DEFAULT_FLOW_STAGES).filter((s) => s.process)

  const rows = []
  for (const stage of stages) {
    const runs = await ProcessRun.find({
      $or: [{ department: stage.key }, { process: stage.process }],
      createdAt: { $gte: from, $lte: to },
    }).lean()
    const completed = runs.filter((r) => r.status === 'COMPLETED' && r.startTime && r.endTime)
    const durations = completed.map((r) => (new Date(r.endTime) - new Date(r.startTime)) / 60000)
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    rows.push({
      department: stage.label,
      key: stage.key,
      jobs: runs.length,
      completed: completed.length,
      pending: runs.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'PENDING').length,
      weight: completed.reduce((s, r) => s + Number(r.outputWeight || 0), 0),
      scrap: completed.reduce((s, r) => s + Number(r.scrap || 0), 0),
      loss: completed.reduce((s, r) => s + Number(r.loss || 0), 0),
      averageProcessingMinutes: Math.round(avg * 10) / 10,
    })
  }
  return { from, to, rows }
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

module.exports = {
  dailyProduction,
  stockMovementReport,
  departmentPerformance,
  qcReport,
  shiftReport,
  traceabilityReport,
}
