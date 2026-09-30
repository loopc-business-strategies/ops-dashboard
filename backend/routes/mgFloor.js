const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { requireMgTenant } = require('../middleware/requireMgTenant')
const { validateBody, validateParams, validateQuery } = require('../middleware/validate')
const { requireProductionPermission, resolveProductionRole, hasProductionPermission } = require('../services/productionControl/permissions')
const ProductionBatch = require('../models/ProductionBatch')
const MetalMovement = require('../models/MetalMovement')
const AuditLog = require('../models/AuditLog')
const ProductionAlert = require('../models/ProductionAlert')
const User = require('../models/User')
const { floorPinError, applyFloorPin } = require('../services/mgFloorPin')
const attendance = require('../services/mgFloor/attendance')
const machineAlertService = require('../services/productionControl/machineAlertService')
const mgFloor = require('../services/mgFloor')
const batchEntries = require('../services/mgFloor/batchEntries')
const batchStats = require('../services/mgFloor/batchStats')
const { syncApprovedEntriesToWorkbook } = require('../services/mgFloor/workbookLink')
const { writeProductionAudit } = require('../services/productionControl/audit')
const { publishRealtimeEvent } = require('../utils/realtimeBus')
const {
  BATCH_ENTRY_DIRECTIONS,
  BATCH_ENTRY_STATUSES,
  BATCH_ENTRY_MAX_LINES,
  normalizeFloorDepartment,
} = require('../constants/mgFloorBatchEntry')

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

/**
 * Nudges open Production Dashboards to reload after the workbook changed. Sent on the Socket.IO
 * /production namespace and the /api/realtime/events SSE stream (the only one that passes the
 * web host's /api rewrite).
 */
function emitWorkbookUpdate(req, event, payload = {}) {
  try {
    const rt = req.app?.get?.('realtimeServer')
    if (rt && typeof rt.broadcastProductionUpdate === 'function') {
      rt.broadcastProductionUpdate('mg', event, payload)
    }
    publishRealtimeEvent({ type: 'production:update', tenant: 'mg', data: { event, ...payload } })
  } catch (err) {
    console.warn('[mg-floor] realtime emit failed', err?.message || err)
  }
}

/** Rings the Call F.M alarm on open Production Dashboards (SSE; the web host does not proxy Socket.IO). */
function emitFmCall(event, id) {
  try {
    publishRealtimeEvent({ type: 'mg-floor:fm-call', tenant: 'mg', data: { event, id: String(id || '') } })
  } catch (err) {
    console.warn('[mg-floor] fm-call emit failed', err?.message || err)
  }
}

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() })
const FM_CALL_CODE = 'FLOOR_MANAGER_CALL'
/** Older unanswered calls stop ringing so a forgotten call does not alarm every day. */
const FM_CALL_RING_WINDOW_MS = 12 * 60 * 60 * 1000

// ── Removed: scales, weight / camera capture, XRF, gateways, pass-based Metal IN / OUT / Transfer ──
const REMOVED_PATHS = [
  '/metal/in',
  '/metal/out',
  '/transfers',
  '/passes/open',
  '/scales{/*rest}',
  '/scale-camera-captures{/*rest}',
  '/xrf{/*rest}',
  '/gateways{/*rest}',
  '/gateway{/*rest}',
]

router.all(REMOVED_PATHS, (req, res) => {
  res.status(410).json({
    success: false,
    code: 'MG_FLOOR_FEATURE_REMOVED',
    message: 'This MG Floor feature was removed. MG Floor uses manual batch entry with Floor Manager approval.',
  })
})

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
    user: {
      id: req.user._id,
      name: req.user.name,
      department: req.user.department,
      floorDepartment: normalizeFloorDepartment(req.user.floorDepartment),
    },
  })
})

// ── Floor PIN (employee self-service) ──────────────
const setPinSchema = Joi.object({
  password: Joi.string().min(1).max(128).required(),
  pin: Joi.string().pattern(/^\d{4,6}$/).required(),
})

router.post('/me/pin', ...mgProtect, validateBody(setPinSchema), async (req, res) => {
  try {
    const TenantUser = await User.getTenantModel(req.tenant)
    const user = await TenantUser.findById(req.user._id).select('+password')
    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ success: false, code: 'WRONG_PASSWORD', message: 'Password is incorrect.' })
    }
    const pinError = floorPinError(req.body.pin)
    if (pinError) return res.status(400).json({ success: false, message: pinError })
    await applyFloorPin(user, req.body.pin)
    await user.save({ validateBeforeSave: false })
    res.json({ success: true, hasFloorPin: true, floorPinSetAt: user.floorPinSetAt })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Tablet attendance (each employee's login / logout) ──
const attendanceLoginSchema = Joi.object({
  loginMethod: Joi.string().valid('password', 'pin', 'biometric', '').optional(),
  deviceLabel: Joi.string().allow('').trim().max(120).optional(),
})
const attendanceQuery = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: Joi.string().valid('OPEN', 'CLOSED').optional(),
  limit: Joi.number().integer().min(1).max(500).optional(),
})

router.post('/attendance/login', ...mgProtect, requireProductionPermission('view'), validateBody(attendanceLoginSchema), async (req, res) => {
  try {
    const result = await attendance.recordLogin(req.user, req.body)
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/attendance/logout', ...mgProtect, async (req, res) => {
  try {
    const result = await attendance.recordLogout(req.user)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/attendance', ...mgProtect, requireProductionPermission('floorSession'), validateQuery(attendanceQuery), async (req, res) => {
  try {
    const rows = await attendance.listAttendance(req.query)
    res.json({ success: true, attendance: rows })
  } catch (err) {
    handleError(res, err)
  }
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

// ── History ────────────────────────────────────────
router.get('/history', ...mgProtect, requireProductionPermission('view'), validateQuery(Joi.object({
  limit: Joi.number().integer().min(1).max(200).default(50),
  skip: Joi.number().integer().min(0).default(0),
  batchId: Joi.string().hex().length(24),
  type: Joi.string().trim(),
  department: Joi.string().trim(),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  motion: Joi.string().valid('in', 'out', 'all').default('all'),
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
    if (req.query.from || req.query.to) {
      filter.createdAt = {}
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from)
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to)
    }
    if (req.query.motion === 'in') {
      filter.receivedAt = { $ne: null }
    } else if (req.query.motion === 'out') {
      filter.issuedAt = { $ne: null }
      filter.receivedAt = null
    }
    const movements = await MetalMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
    const total = await MetalMovement.countDocuments(filter)
    res.json({ success: true, movements, total, limit, skip })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/stats/summary', ...mgProtect, requireProductionPermission('view'), validateQuery(Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  department: Joi.string().trim(),
}).unknown(true)), async (req, res) => {
  try {
    const result = await mgFloor.statsSummary(req.query)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/alerts', ...mgProtect, requireProductionPermission('raiseAlert'), validateBody(Joi.object({
  title: Joi.string().trim().required(),
  message: Joi.string().trim().allow('', null),
  department: Joi.string().trim().allow('', null),
  batchId: Joi.string().hex().length(24).allow(null, ''),
  batchNumber: Joi.string().trim().allow('', null),
  operationId: Joi.string().trim().max(120).allow('', null),
  severity: Joi.string().trim().default('warning'),
}).unknown(true)), async (req, res) => {
  try {
    const result = await mgFloor.raiseFloorAlert(req, req.body)
    emitFmCall('raised', result.alert?._id)
    res.status(201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Call F.M alarm (web Production Dashboard, Floor / Production Managers) ──
router.get('/fm-calls', ...mgProtect, requireProductionPermission('resolveAlert'), async (req, res) => {
  try {
    const calls = await ProductionAlert.find({
      code: FM_CALL_CODE,
      status: 'OPEN',
      createdAt: { $gte: new Date(Date.now() - FM_CALL_RING_WINDOW_MS) },
    })
      .select('title message metadata raisedByName createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
    res.json({ success: true, calls })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/fm-calls/:id/acknowledge', ...mgProtect, requireProductionPermission('resolveAlert'), validateParams(idParam), async (req, res) => {
  try {
    const existing = await ProductionAlert.findById(req.params.id).select('code').lean()
    if (!existing || existing.code !== FM_CALL_CODE) {
      return res.status(404).json({ success: false, message: 'Floor manager call not found' })
    }
    const alert = await machineAlertService.acknowledgeAlert(req, req.params.id)
    emitFmCall('acknowledged', req.params.id)
    res.json({ success: true, alert })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Batch entries (typed Metal In / Out, Floor Manager approval) ──
router.post('/batch-entries', ...mgProtect, requireProductionPermission('view'), validateBody(Joi.object({
  entryId: Joi.string().trim().pattern(/^[A-Za-z0-9_-]{8,120}$/).required(),
  direction: Joi.string().trim().uppercase().valid(...BATCH_ENTRY_DIRECTIONS).required(),
  department: Joi.string().trim().max(80).allow('', null),
  batchLabel: Joi.string().trim().max(20).required(),
  entryDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  deviceId: Joi.string().trim().max(120).allow('', null),
  tzOffsetMinutes: Joi.number().integer().min(-840).max(840).allow(null),
  lines: Joi.array().min(1).max(BATCH_ENTRY_MAX_LINES).items(Joi.object({
    metal: Joi.string().trim().max(40).required(),
    qty: Joi.number().allow(null),
    purity: Joi.number().allow(null),
    time: Joi.string().trim().max(16).allow('', null),
  }).unknown(false)).required(),
}).unknown(false)), async (req, res) => {
  try {
    const result = await batchEntries.submitBatchEntry(req, req.body)
    res.status(result.reused ? 200 : 201).json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/batch-entries', ...mgProtect, requireProductionPermission('view'), validateQuery(Joi.object({
  status: Joi.string().trim().uppercase().valid(...BATCH_ENTRY_STATUSES),
  direction: Joi.string().trim().uppercase().valid(...BATCH_ENTRY_DIRECTIONS),
  department: Joi.string().trim().max(80),
  entryDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/),
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  limit: Joi.number().integer().min(1).max(200).default(50),
  skip: Joi.number().integer().min(0).default(0),
})), async (req, res) => {
  try {
    const result = await batchEntries.listBatchEntries(req.query)
    res.json({ success: true, canDecide: hasProductionPermission(req.user, 'approvePass'), ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batch-entries/:id/approve', ...mgProtect, requireProductionPermission('approvePass'), validateParams(idParam), async (req, res) => {
  try {
    const result = await batchEntries.decideBatchEntry(req, req.params.id, 'APPROVED')
    if (result.workbookEntryId) {
      emitWorkbookUpdate(req, 'workbook.mg_floor_batch', { entryId: String(result.workbookEntryId) })
    }
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

/** Re-applies approved batches to the Operations → Production workbook (idempotent). */
router.post('/batch-entries/sync-workbook', ...mgProtect, requireProductionPermission('approvePass'), async (req, res) => {
  try {
    const result = await syncApprovedEntriesToWorkbook()
    await writeProductionAudit(req, {
      resource: 'OperationsProductionEntry',
      action: 'mg_floor_workbook_synced',
      detail: `MG Floor workbook sync: ${result.linked} of ${result.approved} approved batches linked`,
      changes: result,
    }).catch((err) => console.warn('[mg-floor] workbook sync audit failed', err?.message || err))
    if (result.linked) emitWorkbookUpdate(req, 'workbook.mg_floor_sync', { linked: result.linked })
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/batch-entries/:id/reject', ...mgProtect, requireProductionPermission('approvePass'), validateParams(idParam), validateBody(Joi.object({
  reason: Joi.string().trim().min(3).max(500).required(),
})), async (req, res) => {
  try {
    const result = await batchEntries.decideBatchEntry(req, req.params.id, 'REJECTED', req.body.reason)
    res.json({ success: true, ...result })
  } catch (err) {
    handleError(res, err)
  }
})

// ── Metal loss / batch time (approved batches in the workbook) ──
router.get('/batch-stats', ...mgProtect, requireProductionPermission('view'), validateQuery(Joi.object({
  department: Joi.string().trim().max(80).required(),
  date: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
})), async (req, res) => {
  try {
    const stats = await batchStats.getBatchStats(req.query)
    res.json({ success: true, canSetLossLimit: hasProductionPermission(req.user, 'approvePass'), ...stats })
  } catch (err) {
    handleError(res, err)
  }
})

router.get('/batch-stats/loss-limits', ...mgProtect, requireProductionPermission('view'), async (req, res) => {
  try {
    res.json({ success: true, limits: await batchStats.getLossLimits() })
  } catch (err) {
    handleError(res, err)
  }
})

router.put('/batch-stats/loss-limit', ...mgProtect, requireProductionPermission('approvePass'), validateBody(Joi.object({
  department: Joi.string().trim().max(80).required(),
  lossLimitPct: Joi.number().positive().max(100).allow(null).required(),
})), async (req, res) => {
  try {
    const result = await batchStats.setLossLimit(req, req.body)
    res.json({ success: true, ...result })
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

// ── Sync / devices ─────────────────────────────────
// Legacy operation types stay accepted here so an older tablet's queue is not rejected as a whole;
// the service answers each of them with FEATURE_REMOVED.
router.post('/sync', ...mgProtect, requireProductionPermission('view'), validateBody(Joi.object({
  operations: Joi.array().items(Joi.object({
    operationId: Joi.string().trim().required(),
    operationType: Joi.string().valid('metal_in', 'metal_out', 'transfer', 'weight_adjust', 'xrf_test', 'weight_capture', 'batch_entry', 'scan', 'other').required(),
    payload: Joi.object().unknown(true).default({}),
    deviceId: Joi.string().trim().allow('', null),
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

module.exports = router
