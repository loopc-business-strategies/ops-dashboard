const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { requireMgTenant } = require('../middleware/requireMgTenant')
const { requireMgGateway } = require('../middleware/requireMgGateway')
const { validateBody, validateParams, validateQuery } = require('../middleware/validate')
const { requireProductionPermission, resolveProductionRole, hasProductionPermission } = require('../services/productionControl/permissions')
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
const mgGatewayProtect = [requireMgGateway]

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
  receivedWeight: Joi.number().positive(),
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
    if (req.query.type) filter.metalType = req.query.type
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
    const query = { ...req.query }
    const canManage = hasProductionPermission(req.user, 'manageMachines')
    if (!canManage && req.user?.department && query.department == null && query.search == null) {
      query.department = String(req.user.department)
    }
    const result = await mgFloor.listScales(query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/scales', ...mgProtect, requireProductionPermission('manageMachines'), validateBody(Joi.object({
  scaleId: Joi.string().trim().required(),
  name: Joi.string().trim().allow('', null),
  manufacturer: Joi.string().trim().allow('', null),
  model: Joi.string().trim().allow('', null),
  serialNumber: Joi.string().trim().allow('', null),
  connectionType: Joi.string().trim().allow('', null),
  port: Joi.string().trim().allow('', null),
  baudRate: Joi.number().allow(null),
  dataBits: Joi.number().allow(null),
  parity: Joi.string().trim().allow('', null),
  stopBits: Joi.number().allow(null),
  ipAddress: Joi.string().trim().allow('', null),
  bluetoothId: Joi.string().trim().allow('', null),
  networkPort: Joi.number().allow(null),
  department: Joi.string().trim().allow('', null),
  location: Joi.string().trim().allow('', null),
  unit: Joi.string().trim().allow('', null),
  precision: Joi.number().allow(null),
  gatewayId: Joi.string().trim().required(),
  enabled: Joi.boolean(),
  calibrationDate: Joi.date().allow(null),
  nextCalibrationDate: Joi.date().allow(null),
}).unknown(true)), async (req, res) => {
  try {
    const scale = await mgFloor.createScale(req.body)
    res.status(201).json({ success: true, scale })
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

router.post('/scales/:scaleId/capture-stable', ...mgProtect, requireProductionPermission('receivePass'), async (req, res) => {
  try {
    const scaleId = String(req.params.scaleId || '').toUpperCase()
    const expectedWeight = req.body?.expectedWeight != null ? Number(req.body.expectedWeight) : null
    const captured = await mgFloor.captureStableReading(scaleId, expectedWeight)
    res.json({ success: true, ...captured })
  } catch (err) {
    handleError(res, err)
  }
})

router.patch('/scales/:scaleId', ...mgProtect, requireProductionPermission('manageMachines'), async (req, res) => {
  try {
    const scale = await mgFloor.updateScale(req.params.scaleId, req.body)
    res.json({ success: true, scale })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Gateways (metadata only — secrets stay in env) ─
router.get('/gateways', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await mgFloor.listGateways(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/gateways', ...mgProtect, requireProductionPermission('manageMachines'), validateBody(Joi.object({
  gatewayId: Joi.string().trim().required(),
  name: Joi.string().trim().allow('', null),
  location: Joi.string().trim().allow('', null),
  notes: Joi.string().trim().allow('', null),
  enabled: Joi.boolean(),
}).unknown(true)), async (req, res) => {
  try {
    const gateway = await mgFloor.createGateway(req.body)
    res.status(201).json({ success: true, gateway })
  } catch (err) {
    handleError(res, err)
  }
})

router.patch('/gateways/:gatewayId', ...mgProtect, requireProductionPermission('manageMachines'), async (req, res) => {
  try {
    const gateway = await mgFloor.updateGateway(req.params.gatewayId, req.body)
    res.json({ success: true, gateway })
  } catch (err) {
    handleError(res, err)
  }
})

// Gateway bootstrap — assigned devices for this authenticated gateway
router.get('/gateway/devices', ...mgGatewayProtect, async (req, res) => {
  try {
    const result = await mgFloor.listDevicesForGateway(req.mgGateway?.gatewayId)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/scales/ingest', ...mgGatewayProtect, validateBody(Joi.object({
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
    if (!req.user) {
      req.user = { _id: null, name: `gateway:${req.mgGateway?.gatewayId || 'unknown'}`, role: 'department_user', company: 'mg' }
    }
    if (!req.tenant) req.tenant = 'mg'
    const result = await mgFloor.ingestScaleReading(req, {
      ...req.body,
      gatewayId: req.body.gatewayId || req.mgGateway?.gatewayId,
    })
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
    operationType: Joi.string().valid('metal_in', 'metal_out', 'transfer', 'weight_adjust', 'xrf_test', 'scan', 'other').required(),
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

// ── XRF / Quality Control ──────────────────────────
router.get('/xrf/devices', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await mgFloor.listXrfAnalyzersPaged(req.query)
    res.json({ success: true, devices: result.analyzers, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/xrf/devices', ...mgProtect, requireProductionPermission('manageMachines'), validateBody(Joi.object({
  analyzerId: Joi.string().trim().required(),
  manufacturer: Joi.string().trim().allow('', null),
  model: Joi.string().trim().allow('', null),
  serialNumber: Joi.string().trim().allow('', null),
  connectionType: Joi.string().trim().allow('', null),
  department: Joi.string().trim().allow('', null),
  location: Joi.string().trim().allow('', null),
  gatewayId: Joi.string().trim().required(),
  enabled: Joi.boolean(),
  notes: Joi.string().trim().allow('', null),
}).unknown(true)), async (req, res) => {
  try {
    const device = await mgFloor.createXrfAnalyzer(req.body)
    res.status(201).json({ success: true, device })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/xrf/devices/:id', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const device = await mgFloor.getXrfAnalyzer(req.params.id)
    res.json({ success: true, device })
  } catch (err) {
    handleError(res, err)
  }
})

router.patch('/xrf/devices/:id', ...mgProtect, requireProductionPermission('manageMachines'), async (req, res) => {
  try {
    const device = await mgFloor.patchXrfAnalyzer(req.params.id, req.body || {})
    res.json({ success: true, device })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/xrf/:id/status', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const device = await mgFloor.getXrfAnalyzer(req.params.id)
    res.json({
      success: true,
      analyzerId: device.analyzerId,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      lastError: device.lastError,
      model: device.model,
      connectionType: device.connectionType,
    })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/xrf/ingest', ...mgGatewayProtect, validateBody(Joi.object({
  analyzerId: Joi.string().trim().required(),
  eventType: Joi.string().trim().default('status'),
  status: Joi.string().trim().allow('', null),
  gatewayId: Joi.string().trim().allow('', null),
  model: Joi.string().trim().allow('', null),
  serialNumber: Joi.string().trim().allow('', null),
  firmware: Joi.string().trim().allow('', null),
  error: Joi.string().trim().allow('', null),
  payload: Joi.object().unknown(true),
}).unknown(true)), async (req, res) => {
  try {
    if (!req.user) {
      req.user = { _id: null, name: `gateway:${req.mgGateway?.gatewayId || 'unknown'}`, role: 'department_user', company: 'mg' }
    }
    if (!req.tenant) req.tenant = 'mg'
    const result = await mgFloor.ingestXrfStatus(req, {
      ...req.body,
      gatewayId: req.body.gatewayId || req.mgGateway?.gatewayId,
    })
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/xrf/ingest/result', ...mgGatewayProtect, validateBody(Joi.object({
  analyzerId: Joi.string().trim().required(),
  elements: Joi.array().items(Joi.object({
    symbol: Joi.string().trim().required(),
    value: Joi.number().required(),
    unit: Joi.string().trim().default('%'),
  }).unknown(true)).default([]),
  source: Joi.string().valid('hardware', 'simulated').default('hardware'),
  status: Joi.string().trim().default('COMPLETED'),
  ingestId: Joi.string().trim().allow('', null),
  idempotencyKey: Joi.string().trim().allow('', null),
  gatewayId: Joi.string().trim().allow('', null),
  purity: Joi.number().allow(null),
  fineness: Joi.number().allow(null),
  testedAt: Joi.date().allow(null),
  originalResult: Joi.object().unknown(true).allow(null),
  rawData: Joi.any().allow(null),
  model: Joi.string().trim().allow('', null),
  serialNumber: Joi.string().trim().allow('', null),
}).unknown(true)), async (req, res) => {
  try {
    if (!req.user) {
      req.user = { _id: null, name: `gateway:${req.mgGateway?.gatewayId || 'unknown'}`, role: 'department_user', company: 'mg' }
    }
    if (!req.tenant) req.tenant = 'mg'
    const result = await mgFloor.ingestXrfResult(req, {
      ...req.body,
      gatewayId: req.body.gatewayId || req.mgGateway?.gatewayId,
    })
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/xrf/tests', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const result = await mgFloor.listXrfTests(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/xrf/tests/:id', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    const test = await mgFloor.getXrfTest(req.params.id)
    res.json({ success: true, test })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/xrf/tests', ...mgProtect, requireProductionPermission('receivePass'), validateBody(Joi.object({
  xrfTestId: Joi.string().trim().allow('', null),
  ingestId: Joi.string().trim().allow('', null),
  source: Joi.string().valid('simulated').allow('', null),
  elements: Joi.array().items(Joi.object({
    symbol: Joi.string().trim().required(),
    value: Joi.number().required(),
    unit: Joi.string().trim().default('%'),
  }).unknown(true)).max(32),
  analyzerId: Joi.string().trim().required(),
  batchId: Joi.string().hex().length(24).allow(null, ''),
  batchNumber: Joi.string().trim().allow('', null),
  jobId: Joi.string().trim().allow('', null),
  materialId: Joi.string().trim().allow('', null),
  department: Joi.string().trim().allow('', null),
  scaleId: Joi.string().trim().allow('', null),
  scaleWeight: Joi.number().allow(null),
  scaleReadingId: Joi.string().hex().length(24).allow(null, ''),
  deviceId: Joi.string().trim().allow('', null),
  operationId: Joi.string().trim().allow('', null),
  status: Joi.string().trim().allow('', null),
  purity: Joi.number().allow(null),
  fineness: Joi.number().allow(null),
  originalResult: Joi.object().unknown(true).allow(null),
  rawData: Joi.any().allow(null),
}).unknown(true)), async (req, res) => {
  try {
    const result = await mgFloor.submitXrfTest(req, req.body)
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

module.exports = router
