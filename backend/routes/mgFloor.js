const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { requireMgTenant } = require('../middleware/requireMgTenant')
const { validateBody, validateParams, validateQuery } = require('../middleware/validate')
const { requireProductionPermission, resolveProductionRole } = require('../services/productionControl/permissions')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionPass = require('../models/ProductionPass')
const MetalMovement = require('../models/MetalMovement')
const Scale = require('../models/Scale')
const HardwareEvent = require('../models/HardwareEvent')
const AuditLog = require('../models/AuditLog')
const mgFloor = require('../services/mgFloor')

const router = express.Router()

function handleError(res, err) {
  const status = err.statusCode || err.status || 500
  const code = status >= 500 ? 500 : status
  if (code >= 500) {
    console.error('[mg-floor]', err)
  }
  return res.status(code).json({
    success: false,
    message: err.message || 'MG Floor error',
    code: err.code || undefined,
  })
}

const mgProtect = [protect, requireMgTenant]

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })

// ── Auth / identity ────────────────────────────────
router.get('/me', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const me = await mgFloor.getMe(req)
    res.json({ success: true, tenant: 'mg', ...me })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/auth/login-check', ...mgProtect, async (req, res) => {
  // Post-login gate: JWT already bound; only MG sessions reach here via requireMgTenant
  res.json({
    success: true,
    tenant: 'mg',
    productionRole: resolveProductionRole(req.user),
    user: { id: req.user._id, name: req.user.name, department: req.user.department },
  })
})

// ── Reference data ─────────────────────────────────
router.get('/departments', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const flow = await mgFloor.flowConfigService.getActiveFlowConfig()
    const departments = (flow?.stages || []).map((s) => ({
      key: s.key,
      label: s.label || s.key,
      process: s.process || s.label,
      order: s.order,
    }))
    res.json({ success: true, departments })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/shifts', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const shifts = await mgFloor.shiftService.listShifts()
    res.json({ success: true, shifts })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/shifts/current', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const shift = await mgFloor.shiftService.getCurrentShift()
    res.json({ success: true, shift })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Jobs / tasks ───────────────────────────────────
router.get('/jobs', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await mgFloor.liveFloorService.getMyTasks(req.user)
    const jobs = Array.isArray(result?.tasks) ? result.tasks : Array.isArray(result) ? result : []
    res.json({ success: true, jobs, counts: result?.counts || null })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/jobs/:id', ...mgProtect, requireProductionPermission('view'), validateParams(idParam), async (req, res) => {
  try {
    const batch = await ProductionBatch.findById(req.params.id).lean()
    if (!batch) return res.status(404).json({ success: false, message: 'Job/batch not found' })
    res.json({ success: true, job: batch })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Metal workflows ────────────────────────────────
router.post('/metal/in', ...mgProtect, requireProductionPermission('receivePass'), validateBody(Joi.object({
  passId: Joi.string().hex().length(24).required(),
  scaleId: Joi.string().trim().required(),
  deviceId: Joi.string().trim().allow('', null),
  stableReadingId: Joi.string().hex().length(24).allow(null, ''),
  receivedWeight: Joi.number().min(0),
  operationId: Joi.string().trim().max(120).allow('', null),
  varianceReason: Joi.string().trim().allow(''),
  expectedBatchVersion: Joi.number().integer().min(0),
  allowManualWeight: Joi.boolean().default(false),
}).unknown(true)), async (req, res) => {
  try {
    const result = await mgFloor.metalIn(req, req.body)
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/metal/out', ...mgProtect, requireProductionPermission('createPass'), validateBody(Joi.object({
  passId: Joi.string().hex().length(24).allow(null, ''),
  batchId: Joi.string().hex().length(24).allow(null, ''),
  fromDepartment: Joi.string().trim().allow('', null),
  toDepartment: Joi.string().trim().allow('', null),
  purpose: Joi.string().trim().allow(''),
  scaleId: Joi.string().trim().required(),
  deviceId: Joi.string().trim().allow('', null),
  stableReadingId: Joi.string().hex().length(24).allow(null, ''),
  weight: Joi.number().positive(),
  operationId: Joi.string().trim().max(120).allow('', null),
  allowManualWeight: Joi.boolean().default(false),
}).unknown(true)), async (req, res) => {
  try {
    const result = await mgFloor.metalOut(req, req.body)
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/transfers', ...mgProtect, requireProductionPermission('createPass'), validateBody(Joi.object({
  batchId: Joi.string().hex().length(24).required(),
  fromDepartment: Joi.string().trim().allow('', null),
  toDepartment: Joi.string().trim().required(),
  purpose: Joi.string().trim().allow(''),
  scaleId: Joi.string().trim().required(),
  deviceId: Joi.string().trim().allow('', null),
  stableReadingId: Joi.string().hex().length(24).allow(null, ''),
  weight: Joi.number().positive(),
  operationId: Joi.string().trim().max(120).allow('', null),
  autoIssue: Joi.boolean().default(true),
  allowManualWeight: Joi.boolean().default(false),
}).unknown(true)), async (req, res) => {
  try {
    const result = await mgFloor.transfer(req, req.body)
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── History ────────────────────────────────────────
router.get('/history', ...mgProtect, requireProductionPermission('view'), validateQuery(Joi.object({
  limit: Joi.number().integer().min(1).max(200).default(50),
  skip: Joi.number().integer().min(0).default(0),
  batchId: Joi.string().hex().length(24),
  type: Joi.string().trim(),
  department: Joi.string().trim(),
}).unknown(true)), async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50
    const skip = Number(req.query.skip) || 0
    const filter = {}
    if (req.query.batchId) filter.batchId = req.query.batchId
    if (req.query.department) {
      filter.$or = [
        { fromDepartment: req.query.department },
        { toDepartment: req.query.department },
      ]
    }
    const movements = await MetalMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
    const total = await MetalMovement.countDocuments(filter)
    res.json({ success: true, movements, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/audit', ...mgProtect, requireProductionPermission('viewAudit'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean()
    res.json({ success: true, audit: logs })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Scales ─────────────────────────────────────────
router.get('/scales', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const scales = await mgFloor.ensureDefaultScales()
    res.json({ success: true, scales })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/scales/:scaleId', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const scaleId = String(req.params.scaleId || '').toUpperCase()
    const scale = await Scale.findOne({ scaleId }).lean()
    if (!scale) return res.status(404).json({ success: false, message: 'Scale not found' })
    res.json({ success: true, scale })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/scales/:scaleId/status', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const scaleId = String(req.params.scaleId || '').toUpperCase()
    const scale = await Scale.findOne({ scaleId }).lean()
    if (!scale) return res.status(404).json({ success: false, message: 'Scale not found' })
    const lastReading = await HardwareEvent.findOne({ scaleId }).sort({ createdAt: -1 }).lean()
    res.json({
      success: true,
      scaleId,
      status: scale.status,
      lastWeight: scale.lastWeight,
      lastStable: scale.lastStable,
      lastSeenAt: scale.lastSeenAt,
      lastError: scale.lastError,
      lastReading,
    })
  } catch (err) {
    handleError(res, err)
  }
})

router.patch('/scales/:scaleId', ...mgProtect, requireProductionPermission('manageMachines'), async (req, res) => {
  try {
    const scaleId = String(req.params.scaleId || '').toUpperCase()
    const scale = await Scale.findOne({ scaleId })
    if (!scale) return res.status(404).json({ success: false, message: 'Scale not found' })
    const allowed = [
      'name', 'manufacturer', 'model', 'serialNumber', 'connectionType', 'port',
      'baudRate', 'dataBits', 'parity', 'stopBits', 'ipAddress', 'bluetoothId',
      'department', 'location', 'unit', 'precision', 'calibrationDate',
      'nextCalibrationDate', 'gatewayId', 'enabled',
    ]
    for (const key of allowed) {
      if (req.body[key] !== undefined) scale[key] = req.body[key]
    }
    if (scale.enabled === false) scale.status = 'DISABLED'
    await scale.save()
    res.json({ success: true, scale })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/scales/ingest', ...mgProtect, requireProductionPermission('view'), validateBody(Joi.object({
  deviceType: Joi.string().default('weighing_scale'),
  deviceId: Joi.string().trim().required(),
  scaleId: Joi.string().trim().required(),
  eventType: Joi.string().trim().default('weight_reading'),
  payload: Joi.object().unknown(true).default({}),
  recordedAt: Joi.date().allow(null),
  idempotencyKey: Joi.string().trim().allow('', null),
  gatewayId: Joi.string().trim().allow('', null),
}).unknown(true)), async (req, res) => {
  try {
    const result = await mgFloor.ingestScaleReading(req, req.body)
    const io = req.app?.get?.('io')
    if (io && !result.reused) {
      io.to('tenant:mg').emit('mg-floor:scale', {
        scaleId: result.scale?.scaleId,
        weight: result.event?.weight,
        stable: result.event?.stable,
        status: result.scale?.status,
        timestamp: result.event?.recordedAt || result.event?.receivedAt,
      })
    }
    res.status(result.reused ? 200 : 202).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Sync / devices ─────────────────────────────────
router.post('/sync', ...mgProtect, requireProductionPermission('view'), validateBody(Joi.object({
  operations: Joi.array().items(Joi.object({
    operationId: Joi.string().trim().required(),
    operationType: Joi.string().valid('metal_in', 'metal_out', 'transfer', 'weight_adjust', 'scan', 'other').required(),
    payload: Joi.object().unknown(true).default({}),
    deviceId: Joi.string().trim().allow('', null),
    scaleId: Joi.string().trim().allow('', null),
    clientTimestamp: Joi.date().allow(null),
  }).unknown(true)).min(1).required(),
})), async (req, res) => {
  try {
    const results = await mgFloor.syncOperations(req, req.body.operations)
    res.json({ success: true, results })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/devices/register', ...mgProtect, requireProductionPermission('view'), validateBody(Joi.object({
  deviceId: Joi.string().trim().required(),
  appVersion: Joi.string().trim().allow(''),
  os: Joi.string().trim().allow(''),
  model: Joi.string().trim().allow(''),
  department: Joi.string().trim().allow(''),
  pushToken: Joi.string().trim().allow(''),
}).unknown(true)), async (req, res) => {
  try {
    const device = await mgFloor.registerDevice(req, req.body)
    res.json({ success: true, device })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Supervisor correction ──────────────────────────
router.post('/corrections/weight', ...mgProtect, requireProductionPermission('adjustWeight'), validateBody(Joi.object({
  batchId: Joi.string().hex().length(24).required(),
  field: Joi.string().default('currentWeight'),
  adjustment: Joi.number().invalid(0).required(),
  reason: Joi.string().trim().min(3).required(),
  operationId: Joi.string().trim().allow('', null),
  expectedBatchVersion: Joi.number().integer().min(0),
})), async (req, res) => {
  try {
    const adjusted = await mgFloor.processService.adjustWeight(req, req.body.batchId, {
      field: req.body.field,
      adjustment: req.body.adjustment,
      reason: req.body.reason,
      idempotencyKey: req.body.operationId || null,
      expectedBatchVersion: req.body.expectedBatchVersion,
    })
    res.status(adjusted.reused ? 200 : 201).json({ success: true, ...adjusted })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Open passes helper for Metal IN ────────────────
router.get('/passes/open', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const filter = { status: { $in: ['ISSUED', 'IN_TRANSIT', 'APPROVED'] } }
    if (req.query.toDepartment) filter.toDepartment = req.query.toDepartment
    if (req.query.batchId) filter.batchId = req.query.batchId
    const passes = await ProductionPass.find(filter).sort({ createdAt: -1 }).limit(100).lean()
    res.json({ success: true, passes })
  } catch (err) {
    handleError(res, err)
  }
})

module.exports = router
