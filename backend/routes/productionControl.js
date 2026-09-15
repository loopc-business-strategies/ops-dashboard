const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { validateBody, validateQuery, validateParams } = require('../middleware/validate')
const { requireProductionPermission, resolveProductionRole } = require('../services/productionControl/permissions')
const { batchService, passService, processService, liveFloorService, machineAlertService, custodyDelayReworkService, flowConfigService, stockService, departmentService, shiftService, floorSessionService, reportService } = require('../services/productionControl')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionPass = require('../models/ProductionPass')
const MetalMovement = require('../models/MetalMovement')
const ProcessRun = require('../models/ProcessRun')
const QcInspection = require('../models/QcInspection')
const ProductionMachine = require('../models/ProductionMachine')
const ProductionAlert = require('../models/ProductionAlert')
const WeightAdjustment = require('../models/WeightAdjustment')
const AuditLog = require('../models/AuditLog')
const { METAL_TYPES, QC_RESULTS, MACHINE_STATUSES } = require('../services/productionControl/constants')

const router = express.Router()

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

/**
 * Defense-in-depth: reject mutations when client signals demo mode.
 * Demo UI already isolates writes; this prevents accidental live writes.
 */
function rejectDemoMutations(req, res, next) {
  const flag = String(req.get('x-pcc-demo') || req.get('X-PCC-Demo') || '').trim()
  if (flag === '1' || flag.toLowerCase() === 'true') {
    return res.status(403).json({
      success: false,
      message: 'DEMO MODE — mutations to live production data are not allowed',
      demo: true,
    })
  }
  return next()
}

router.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  return rejectDemoMutations(req, res, next)
})

function parseListPaging(query) {
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
  const skip = Math.max(0, Number(query.skip) || ((Math.max(1, Number(query.page) || 1) - 1) * limit))
  const search = String(query.search || query.q || '').trim()
  return { limit, skip, search }
}

function handleError(res, err) {
  const status = err.status || 500
  if (status >= 500) console.error('[production-control]', err)
  return res.status(status).json({ success: false, message: err.message || 'Production control error' })
}

function emitProduction(req, event, payload = {}) {
  try {
    const rt = req.app?.get?.('realtimeServer')
    if (rt && typeof rt.broadcastProductionUpdate === 'function') {
      rt.broadcastProductionUpdate(req.tenant, event, payload)
    }
  } catch (err) {
    console.error('[production-control] realtime emit failed:', err.message)
  }
}

// ── Me / flow ──────────────────────────────────────
router.get('/me', protect, requireProductionPermission('view'), async (req, res) => {
  res.json({
    success: true,
    productionRole: resolveProductionRole(req.user),
    user: { id: req.user._id, name: req.user.name, role: req.user.role, department: req.user.department },
  })
})

router.get('/flow', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const flow = await flowConfigService.getActiveFlowConfig()
    res.json({ success: true, flow })
  } catch (err) {
    handleError(res, err)
  }
})

router.put('/flow', protect, requireProductionPermission('manageFlow'), async (req, res) => {
  try {
    const flow = await flowConfigService.ensureDefaultFlowConfig()
    if (Array.isArray(req.body.stages) && req.body.stages.length) {
      flow.stages = req.body.stages
    }
    if (req.body.weightTolerancePct != null) flow.weightTolerancePct = Number(req.body.weightTolerancePct)
    if (typeof req.body.autoHoldOnVariance === 'boolean') flow.autoHoldOnVariance = req.body.autoHoldOnVariance
    if (req.body.name) flow.name = String(req.body.name)
    if (req.body.alertThresholds && typeof req.body.alertThresholds === 'object') {
      flow.alertThresholds = { ...(flow.alertThresholds || {}), ...req.body.alertThresholds }
    }
    await flow.save()
    emitProduction(req, 'flow.updated', { flowId: flow._id })
    res.json({ success: true, flow })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Live floor / search ────────────────────────────
router.get('/live-floor', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const summary = await liveFloorService.getLiveFloorSummary()
    res.json({ success: true, ...summary })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/my-tasks', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await liveFloorService.getMyTasks(req.user)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/work-orders-summary', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const summary = await liveFloorService.getWorkOrdersSummary()
    res.json({ success: true, ...summary })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/metal-custody', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await custodyDelayReworkService.getMetalCustody(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/delays', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await custodyDelayReworkService.getDelays()
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/rework-queue', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await custodyDelayReworkService.getReworkQueue(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/search', protect, requireProductionPermission('view'), validateQuery(Joi.object({
  batchNumber: Joi.string().trim().allow(''),
  passNumber: Joi.string().trim().allow(''),
  workOrder: Joi.string().trim().allow(''),
  employee: Joi.string().trim().allow(''),
  department: Joi.string().trim().allow(''),
  metal: Joi.string().trim().allow(''),
  stockCode: Joi.string().trim().allow(''),
  product: Joi.string().trim().allow(''),
  design: Joi.string().trim().allow(''),
  machine: Joi.string().trim().allow(''),
  status: Joi.string().trim().allow(''),
  q: Joi.string().trim().allow(''),
  search: Joi.string().trim().allow(''),
}).unknown(true)), async (req, res) => {
  try {
    const result = await liveFloorService.searchProduction(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Batches ────────────────────────────────────────
router.get('/batches', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const { limit, skip, search } = parseListPaging(req.query)
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.department) filter.currentDepartment = req.query.department
    if (req.query.metalType) filter.metalType = req.query.metalType
    if (req.query.workOrderId) filter.workOrderId = req.query.workOrderId
    if (search) {
      filter.$or = [
        { batchNumber: new RegExp(search, 'i') },
        { workOrderNumber: new RegExp(search, 'i') },
        { product: new RegExp(search, 'i') },
        { currentHolderName: new RegExp(search, 'i') },
      ]
    }
    const [batches, total] = await Promise.all([
      ProductionBatch.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      ProductionBatch.countDocuments(filter),
    ])
    res.json({ success: true, batches, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/batches/:id', protect, requireProductionPermission('view'), validateParams(idParam), async (req, res) => {
  try {
    const detail = await liveFloorService.getBatchDetail(req.params.id)
    if (!detail) return res.status(404).json({ success: false, message: 'Batch not found' })
    res.json({ success: true, ...detail })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batches', protect, requireProductionPermission('createBatch'), validateBody(Joi.object({
  metalType: Joi.string().valid(...METAL_TYPES).required(),
  purity: Joi.string().trim().allow(''),
  initialWeight: Joi.number().positive().required(),
  product: Joi.string().trim().allow(''),
  purpose: Joi.string().trim().allow(''),
  targetQuantity: Joi.number().min(0),
  workOrderId: Joi.string().hex().length(24).allow(null, ''),
  workOrderNumber: Joi.string().trim().allow(''),
  inventoryItemId: Joi.string().hex().length(24).allow(null, ''),
  idempotencyKey: Joi.string().trim().allow('', null),
})), async (req, res) => {
  try {
    const body = { ...req.body }
    if (!body.workOrderId) body.workOrderId = null
    if (!body.inventoryItemId) body.inventoryItemId = null
    const { batch, reused } = await batchService.createBatch(req, body)
    if (!reused) emitProduction(req, 'batch.created', { batchId: batch._id, batchNumber: batch.batchNumber })
    res.status(reused ? 200 : 201).json({ success: true, batch, reused })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batches/:id/issue-from-vault', protect, requireProductionPermission('issueMetal'), validateParams(idParam), validateBody(Joi.object({
  inventoryItemId: Joi.string().hex().length(24).allow(null, ''),
  weight: Joi.number().positive().required(),
  purpose: Joi.string().trim().allow(''),
  expectedVersion: Joi.number().integer().min(0),
  idempotencyKey: Joi.string().trim().allow('', null),
})), async (req, res) => {
  try {
    const body = { ...req.body }
    if (!body.inventoryItemId) body.inventoryItemId = null
    if (!body.idempotencyKey) body.idempotencyKey = null
    const { batch, reused } = await batchService.issueFromVault(req, req.params.id, body)
    if (!reused) emitProduction(req, 'batch.issued', { batchId: batch._id, batchNumber: batch.batchNumber })
    res.json({ success: true, batch, reused: Boolean(reused) })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batches/:id/hold', protect, requireProductionPermission('holdRelease'), validateParams(idParam), async (req, res) => {
  try {
    const batch = await batchService.holdBatch(req, req.params.id, req.body || {})
    emitProduction(req, 'batch.put_on_hold', { batchId: batch._id })
    res.json({ success: true, batch })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batches/:id/release', protect, requireProductionPermission('holdRelease'), validateParams(idParam), async (req, res) => {
  try {
    const batch = await batchService.releaseBatch(req, req.params.id, req.body || {})
    emitProduction(req, 'batch.released', { batchId: batch._id })
    res.json({ success: true, batch })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batches/:id/return-to-vault', protect, requireProductionPermission('returnToVault'), validateParams(idParam), async (req, res) => {
  try {
    const batch = await batchService.returnToVault(req, req.params.id, req.body || {})
    emitProduction(req, 'batch.returned_to_vault', { batchId: batch._id })
    res.json({ success: true, batch })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batches/:id/weight-adjustments', protect, requireProductionPermission('adjustWeight'), validateParams(idParam), validateBody(Joi.object({
  field: Joi.string().default('currentWeight'),
  adjustment: Joi.number().invalid(0).required(),
  reason: Joi.string().trim().min(3).required(),
  idempotencyKey: Joi.string().trim().allow('', null),
  expectedVersion: Joi.number().integer().min(0),
  expectedBatchVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const body = { ...req.body }
    if (body.expectedBatchVersion == null && body.expectedVersion != null) {
      body.expectedBatchVersion = body.expectedVersion
    }
    const result = await processService.adjustWeight(req, req.params.id, body)
    emitProduction(req, 'weight.adjusted', { batchId: req.params.id })
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Passes ─────────────────────────────────────────
router.get('/passes', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const { limit, skip } = parseListPaging(req.query)
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.batchId) filter.batchId = req.query.batchId
    const [passes, total] = await Promise.all([
      ProductionPass.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProductionPass.countDocuments(filter),
    ])
    res.json({ success: true, passes, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/passes', protect, requireProductionPermission('createPass'), validateBody(Joi.object({
  batchId: Joi.string().hex().length(24).required(),
  fromDepartment: Joi.string().trim().allow(''),
  toDepartment: Joi.string().trim().required(),
  toPersonId: Joi.string().hex().length(24).allow(null, ''),
  toPersonName: Joi.string().trim().allow(''),
  weight: Joi.number().positive().required(),
  purpose: Joi.string().trim().allow(''),
  machineId: Joi.string().hex().length(24).allow(null, ''),
  machineName: Joi.string().trim().allow(''),
  idempotencyKey: Joi.string().trim().allow('', null),
})), async (req, res) => {
  try {
    const { pass, reused } = await passService.createPass(req, req.body)
    if (!reused) emitProduction(req, 'pass.created', { passId: pass._id, passNumber: pass.passNumber })
    res.status(reused ? 200 : 201).json({ success: true, pass, reused })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/passes/:id/approve', protect, requireProductionPermission('approvePass'), validateParams(idParam), async (req, res) => {
  try {
    const pass = await passService.approvePass(req, req.params.id)
    emitProduction(req, 'pass.approved', { passId: pass._id })
    res.json({ success: true, pass })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/passes/:id/issue', protect, requireProductionPermission('issueMetal'), validateParams(idParam), async (req, res) => {
  try {
    const result = await passService.issuePass(req, req.params.id, req.body || {})
    emitProduction(req, 'batch.transferred', { passId: result.pass._id, batchId: result.pass.batchId })
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/passes/:id/receive', protect, requireProductionPermission('receivePass'), validateParams(idParam), validateBody(Joi.object({
  receivedWeight: Joi.number().min(0),
  expectedBatchVersion: Joi.number().integer().min(0),
  expectedVersion: Joi.number().integer().min(0),
  receiveIdempotencyKey: Joi.string().trim().allow('', null),
  varianceReason: Joi.string().trim().allow(''),
}).unknown(true)), async (req, res) => {
  try {
    const body = { ...req.body }
    if (body.expectedBatchVersion == null && body.expectedVersion != null) {
      body.expectedBatchVersion = body.expectedVersion
    }
    const result = await passService.receivePass(req, req.params.id, body)
    if (!result.reused) emitProduction(req, 'pass.received', { passId: result.pass._id, batchId: result.batch?._id })
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/passes/:id/cancel', protect, requireProductionPermission('approvePass'), validateParams(idParam), async (req, res) => {
  try {
    const result = await passService.cancelPass(req, req.params.id, req.body || {})
    const pass = result?.pass || result
    const batch = result?.batch || null
    res.json({ success: true, pass, batch })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Movements ──────────────────────────────────────
router.get('/movements', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const { limit, skip } = parseListPaging(req.query)
    const filter = {}
    if (req.query.batchId) filter.batchId = req.query.batchId
    const [movements, total] = await Promise.all([
      MetalMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      MetalMovement.countDocuments(filter),
    ])
    res.json({ success: true, movements, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Processes ──────────────────────────────────────
router.get('/processes', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const { limit, skip } = parseListPaging(req.query)
    const filter = {}
    if (req.query.batchId) filter.batchId = req.query.batchId
    if (req.query.status) filter.status = req.query.status
    const [processes, total] = await Promise.all([
      ProcessRun.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProcessRun.countDocuments(filter),
    ])
    res.json({ success: true, processes, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/processes/start', protect, requireProductionPermission('startProcess'), validateBody(Joi.object({
  batchId: Joi.string().hex().length(24).required(),
  process: Joi.string().trim().required(),
  department: Joi.string().trim().allow(''),
  machineId: Joi.string().hex().length(24).allow(null, ''),
  machineName: Joi.string().trim().allow(''),
  inputWeight: Joi.number().min(0),
  details: Joi.object().unknown(true),
  expectedBatchVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const result = await processService.startProcess(req, req.body)
    emitProduction(req, 'process.started', { processRunId: result.processRun._id, batchId: result.batch._id })
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/processes/:id/complete', protect, requireProductionPermission('completeProcess'), validateParams(idParam), validateBody(Joi.object({
  outputWeight: Joi.number().min(0).required(),
  scrap: Joi.number().min(0),
  loss: Joi.number().min(0),
  sopFollowed: Joi.boolean().allow(null),
  sopReason: Joi.string().trim().allow(''),
  remarks: Joi.string().trim().allow(''),
  details: Joi.object().unknown(true),
  completeIdempotencyKey: Joi.string().trim().allow('', null),
  expectedBatchVersion: Joi.number().integer().min(0),
  expectedVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const result = await processService.completeProcess(req, req.params.id, req.body)
    if (!result.reused) {
      emitProduction(req, 'process.completed', { processRunId: result.processRun._id, batchId: result.batch._id })
      if (result.alert) emitProduction(req, 'weight.variance_detected', { alertId: result.alert._id })
    }
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── QC ─────────────────────────────────────────────
router.get('/qc', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const { limit, skip } = parseListPaging(req.query)
    const filter = {}
    if (req.query.batchId) filter.batchId = req.query.batchId
    if (req.query.result) filter.result = req.query.result
    const [inspections, total] = await Promise.all([
      QcInspection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      QcInspection.countDocuments(filter),
    ])
    res.json({ success: true, inspections, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/qc', protect, requireProductionPermission('submitQc'), validateBody(Joi.object({
  batchId: Joi.string().hex().length(24).required(),
  process: Joi.string().trim().allow(''),
  processRunId: Joi.string().hex().length(24).allow(null, ''),
  result: Joi.string().valid(...QC_RESULTS).required(),
  weight: Joi.number().min(0).allow(null),
  purity: Joi.string().trim().allow(''),
  dimensions: Joi.string().trim().allow(''),
  finish: Joi.string().trim().allow(''),
  stamp: Joi.string().trim().allow(''),
  visualQuality: Joi.string().trim().allow(''),
  sop: Joi.boolean().allow(null),
  remarks: Joi.string().trim().allow(''),
  reworkReason: Joi.string().trim().allow(''),
  failureReason: Joi.string().trim().allow(''),
  reworkOf: Joi.string().hex().length(24).allow(null, ''),
  previousInspectionId: Joi.string().hex().length(24).allow(null, ''),
  idempotencyKey: Joi.string().trim().allow('', null),
  expectedBatchVersion: Joi.number().integer().min(0),
  expectedVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const result = await processService.submitQc(req, req.body)
    const event =
      req.body.result === 'PASS' ? 'batch.qc_passed'
        : req.body.result === 'FAIL' ? 'batch.qc_failed'
          : req.body.result === 'REWORK' ? 'batch.rework_started'
            : 'batch.qc_submitted'
    if (!result.reused) emitProduction(req, event, { inspectionId: result.inspection._id, batchId: result.batch._id })
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Machines ───────────────────────────────────────
router.get('/machines', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const machines = await ProductionMachine.find({ isActive: true }).sort({ name: 1 }).lean()
    res.json({ success: true, machines })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/machines', protect, requireProductionPermission('manageMachines'), validateBody(Joi.object({
  machineCode: Joi.string().trim().required(),
  name: Joi.string().trim().required(),
  department: Joi.string().trim().allow(''),
  process: Joi.string().trim().allow(''),
  notes: Joi.string().trim().allow(''),
})), async (req, res) => {
  try {
    const machine = await machineAlertService.createMachine(req, req.body)
    emitProduction(req, 'machine.started', { machineId: machine._id })
    res.status(201).json({ success: true, machine })
  } catch (err) {
    handleError(res, err)
  }
})

router.patch('/machines/:id/status', protect, requireProductionPermission('manageMachines'), validateParams(idParam), validateBody(Joi.object({
  status: Joi.string().valid(...MACHINE_STATUSES).required(),
  expectedStatus: Joi.string().valid(...MACHINE_STATUSES),
})), async (req, res) => {
  try {
    const machine = await machineAlertService.updateMachineStatus(req, req.params.id, req.body)
    const event =
      req.body.status === 'RUNNING' ? 'machine.started'
        : req.body.status === 'FAULT' ? 'machine.fault'
          : 'machine.stopped'
    emitProduction(req, event, { machineId: machine._id, status: machine.status })
    res.json({ success: true, machine })
  } catch (err) {
    handleError(res, err)
  }
})

router.patch('/machines/:id', protect, requireProductionPermission('manageMachines'), validateParams(idParam), validateBody(Joi.object({
  lastMaintenance: Joi.date().iso().allow(null),
  nextMaintenance: Joi.date().iso().allow(null),
  notes: Joi.string().trim().allow('').max(2000),
}).min(1)), async (req, res) => {
  try {
    const machine = await machineAlertService.updateMachine(req, req.params.id, req.body)
    emitProduction(req, 'machine.updated', { machineId: machine._id })
    res.json({ success: true, machine })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Alerts ─────────────────────────────────────────
router.get('/alerts', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const { limit, skip } = parseListPaging(req.query)
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    const [alerts, total] = await Promise.all([
      ProductionAlert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProductionAlert.countDocuments(filter),
    ])
    res.json({ success: true, alerts, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/alerts', protect, requireProductionPermission('raiseAlert'), async (req, res) => {
  try {
    const alert = await machineAlertService.raiseAlert(req, req.body || {})
    res.status(201).json({ success: true, alert })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/alerts/:id/acknowledge', protect, requireProductionPermission('resolveAlert'), validateParams(idParam), async (req, res) => {
  try {
    const alert = await machineAlertService.acknowledgeAlert(req, req.params.id)
    emitProduction(req, 'alert.acknowledged', { alertId: alert._id })
    res.json({ success: true, alert })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/alerts/:id/resolve', protect, requireProductionPermission('resolveAlert'), validateParams(idParam), async (req, res) => {
  try {
    const alert = await machineAlertService.resolveAlert(req, req.params.id)
    emitProduction(req, 'alert.resolved', { alertId: alert._id })
    res.json({ success: true, alert })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Audit (production resources only; never deletes) ─
router.get('/audit', protect, requireProductionPermission('viewAudit'), async (req, res) => {
  try {
    const resources = [
      'ProductionBatch',
      'ProductionPass',
      'MetalMovement',
      'ProcessRun',
      'QcInspection',
      'WeightAdjustment',
      'ProductionMachine',
      'ProductionAlert',
      'ProductionStockLot',
      'ProductionShiftConfig',
      'ProductionFloorSession',
    ]
    const logs = await AuditLog.find({ resource: { $in: resources } })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean()
    res.json({ success: true, logs })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/weight-adjustments', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const filter = {}
    if (req.query.batchId) filter.batchId = req.query.batchId
    const adjustments = await WeightAdjustment.find(filter).sort({ createdAt: -1 }).limit(200).lean()
    res.json({ success: true, adjustments })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Stock Control ──────────────────────────────────
router.get('/stock/overview', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const overview = await stockService.getStockOverview()
    res.json({ success: true, overview })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/stock', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await stockService.listStock(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/stock/history', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await stockService.getStockHistory(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/stock/:id', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const detail = await stockService.getStockDetail(req.params.id)
    if (!detail) return res.status(404).json({ success: false, message: 'Stock not found' })
    res.json({ success: true, ...detail })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/stock', protect, requireProductionPermission('manageStock'), validateBody(Joi.object({
  purchaseRef: Joi.string().trim().allow(''),
  supplier: Joi.string().trim().allow(''),
  purchaseDate: Joi.date().allow(null, ''),
  product: Joi.string().trim().allow(''),
  productCode: Joi.string().trim().allow(''),
  category: Joi.string().trim().allow(''),
  designNumber: Joi.string().trim().allow(''),
  quantity: Joi.number().min(0),
  grossWeight: Joi.number().min(0),
  netWeight: Joi.number().min(0),
  metalType: Joi.string().valid(...METAL_TYPES),
  purity: Joi.string().trim().allow(''),
  size: Joi.string().trim().allow(''),
  remarks: Joi.string().trim().allow(''),
  inventoryItemId: Joi.string().hex().length(24).allow(null, ''),
  attachmentRefs: Joi.array().items(Joi.object({
    name: Joi.string().allow(''),
    url: Joi.string().allow(''),
  }).unknown(true)),
  idempotencyKey: Joi.string().trim().allow('', null),
})), async (req, res) => {
  try {
    const body = { ...req.body }
    if (!body.inventoryItemId) body.inventoryItemId = null
    if (!body.purchaseDate) body.purchaseDate = null
    const { lot, reused } = await stockService.createStock(req, body)
    if (!reused) emitProduction(req, 'stock.created', { stockLotId: lot._id, stockCode: lot.stockCode })
    res.status(reused ? 200 : 201).json({ success: true, lot, reused })
  } catch (err) {
    handleError(res, err)
  }
})

router.patch('/stock/:id', protect, requireProductionPermission('manageStock'), validateParams(idParam), async (req, res) => {
  try {
    const lot = await stockService.updateStock(req, req.params.id, req.body || {})
    emitProduction(req, 'stock.updated', { stockLotId: lot._id })
    res.json({ success: true, lot })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/stock/:id/available', protect, requireProductionPermission('manageStock'), validateParams(idParam), async (req, res) => {
  try {
    const lot = await stockService.markAvailable(req, req.params.id, req.body || {})
    emitProduction(req, 'stock.available', { stockLotId: lot._id })
    res.json({ success: true, lot })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/stock/select', protect, requireProductionPermission('selectStock'), validateBody(Joi.object({
  stockLotId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().min(0).allow(null),
  weight: Joi.number().positive().allow(null),
  product: Joi.string().trim().allow(''),
  purpose: Joi.string().trim().allow(''),
  workOrderId: Joi.string().hex().length(24).allow(null, ''),
  workOrderNumber: Joi.string().trim().allow(''),
  markIssued: Joi.boolean(),
  idempotencyKey: Joi.string().trim().allow('', null),
  expectedVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const body = { ...req.body }
    if (!body.workOrderId) body.workOrderId = null
    const result = await stockService.selectAndAllocate(req, body)
    emitProduction(req, 'stock.allocated', {
      stockLotId: result.lot._id,
      batchId: result.batch._id,
      batchNumber: result.batch.batchNumber,
    })
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/stock/:id/adjust', protect, requireProductionPermission('adjustStock'), validateParams(idParam), validateBody(Joi.object({
  quantityDelta: Joi.number(),
  weightDelta: Joi.number(),
  reason: Joi.string().trim().min(3).required(),
  expectedVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const lot = await stockService.adjustStock(req, req.params.id, req.body)
    emitProduction(req, 'stock.adjusted', { stockLotId: lot._id })
    res.json({ success: true, lot })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/stock/:id/dispatch', protect, requireProductionPermission('dispatchStock'), validateParams(idParam), validateBody(Joi.object({
  reason: Joi.string().trim().allow(''),
  expectedVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const lot = await stockService.dispatchStock(req, req.params.id, req.body || {})
    emitProduction(req, 'stock.dispatched', { stockLotId: lot._id, stockCode: lot.stockCode })
    res.json({ success: true, lot })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Departments ────────────────────────────────────
router.get('/departments', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const departments = await departmentService.listDepartmentStatuses()
    res.json({ success: true, departments })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/departments/:key', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const dashboard = await departmentService.getDepartmentDashboard(req.params.key)
    res.json({ success: true, ...dashboard })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Shifts ─────────────────────────────────────────
router.get('/shifts', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const [shifts, current] = await Promise.all([
      shiftService.listShifts(),
      shiftService.getCurrentShift(),
    ])
    res.json({ success: true, shifts, current })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/shifts/current', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const current = await shiftService.getCurrentShift()
    res.json({ success: true, current })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/shifts', protect, requireProductionPermission('manageShifts'), validateBody(Joi.object({
  id: Joi.string().hex().length(24).allow(null, ''),
  name: Joi.string().trim().required(),
  startTime: Joi.string().trim().required(),
  endTime: Joi.string().trim().required(),
  breakMinutes: Joi.number().min(0),
  isActive: Joi.boolean(),
  workingDays: Joi.array().items(Joi.string()),
  sortOrder: Joi.number(),
})), async (req, res) => {
  try {
    const body = { ...req.body }
    if (!body.id) body.id = null
    const shift = await shiftService.upsertShift(req, body)
    emitProduction(req, 'shift.updated', { shiftId: shift._id })
    res.json({ success: true, shift })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Floor manager sessions ─────────────────────────
router.post('/floor-sessions/login', protect, requireProductionPermission('floorSession'), async (req, res) => {
  try {
    const result = await floorSessionService.startSession(req, req.body || {})
    emitProduction(req, 'floor.session_started', { sessionId: result.session._id })
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/floor-sessions/logout', protect, requireProductionPermission('floorSession'), async (req, res) => {
  try {
    const session = await floorSessionService.endSession(req)
    emitProduction(req, 'floor.session_ended', { sessionId: session._id })
    res.json({ success: true, session })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/floor-sessions/heartbeat', protect, requireProductionPermission('floorSession'), async (req, res) => {
  try {
    const session = await floorSessionService.heartbeat(req)
    res.json({ success: true, session })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/floor-sessions', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await floorSessionService.listSessions(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Reports & traceability ─────────────────────────
router.get('/reports/daily', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.dailyProduction(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/reports/stock-movement', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.stockMovementReport(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/reports/department-performance', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.departmentPerformance(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/reports/qc', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.qcReport(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/reports/shift', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.shiftReport(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/reports/metal-custody', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.metalCustodySummary(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/reports/weight-variance', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.weightVarianceReport(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/reports/machine-performance', protect, requireProductionPermission('viewReports'), async (req, res) => {
  try {
    const report = await reportService.machinePerformanceReport(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/traceability', protect, requireProductionPermission('view'), async (req, res) => {
  try {
    const report = await reportService.traceabilityReport(req.query)
    res.json({ success: true, report })
  } catch (err) {
    handleError(res, err)
  }
})

module.exports = router
