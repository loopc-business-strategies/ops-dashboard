const Scale = require('../../models/Scale')
const HardwareEvent = require('../../models/HardwareEvent')
const FloorDevice = require('../../models/FloorDevice')
const FloorSyncOperation = require('../../models/FloorSyncOperation')
const MetalMovement = require('../../models/MetalMovement')
const {
  passService,
  batchService,
  processService,
  liveFloorService,
  departmentService,
  shiftService,
  flowConfigService,
  resolveProductionRole,
  hasProductionPermission,
} = require('../productionControl')
const { ProductionError } = require('../productionControl/errors')
const xrf = require('./xrf')
const deviceRegistry = require('./deviceRegistry')

const {
  DEFAULT_MG_SCALES,
  ensureDefaultScales,
  listScales,
  createScale,
  updateScale,
  assertGatewayOwnsDevice,
  listGateways,
  createGateway,
  updateGateway,
  listXrfAnalyzersPaged,
  createXrfAnalyzer,
  listDevicesForGateway,
} = deviceRegistry

async function getMe(req) {
  const shift = await shiftService.getCurrentShift().catch(() => null)
  return {
    productionRole: resolveProductionRole(req.user),
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      department: req.user.department,
      productionRole: resolveProductionRole(req.user),
    },
    shift,
    permissions: {
      metalIn: hasProductionPermission(req.user, 'receivePass'),
      metalOut: hasProductionPermission(req.user, 'createPass'),
      transfer: hasProductionPermission(req.user, 'createPass'),
      adjustWeight: hasProductionPermission(req.user, 'adjustWeight'),
      viewAudit: hasProductionPermission(req.user, 'viewAudit'),
      manageScales: hasProductionPermission(req.user, 'manageMachines'),
    },
  }
}

const STABLE_READING_MAX_AGE_MS = Number(process.env.MG_STABLE_READING_MAX_AGE_MS || 2 * 60 * 1000)
const STABLE_WEIGHT_TOLERANCE_G = Number(process.env.MG_STABLE_WEIGHT_TOLERANCE_G || 0.5)

/**
 * @param {object} [opts]
 * @param {boolean} [opts.requireId] When true (metal submit), stableReadingId is mandatory — no latest fallback.
 * @param {boolean} [opts.allowLatestFallback] When true (capture endpoint only), resolve latest stable if id omitted.
 */
async function assertScaleReading(scaleId, stableReadingId, expectedWeight, opts = {}) {
  const requireId = opts.requireId === true
  const allowLatestFallback = opts.allowLatestFallback === true && !requireId

  if (!scaleId) throw new ProductionError('scaleId is required for floor weight capture')
  const scale = await Scale.findOne({ scaleId: String(scaleId).toUpperCase() })
  if (!scale || !scale.enabled) throw new ProductionError('Scale not found or disabled', 404)
  if (scale.status === 'DISABLED') throw new ProductionError('Scale is disabled')

  const id = stableReadingId ? String(stableReadingId).trim() : ''
  if (requireId && !id) {
    throw new ProductionError(
      'stableReadingId is required. Capture a stable scale reading before submitting.',
      400,
    )
  }

  let reading = null
  if (id) {
    reading = await HardwareEvent.findById(id)
    if (!reading) throw new ProductionError('Stable scale reading not found', 404)
    if (String(reading.scaleId || '').toUpperCase() !== String(scaleId).toUpperCase()) {
      throw new ProductionError('Scale reading does not match scaleId', 403)
    }
    if (!reading.stable) throw new ProductionError('Scale reading is not stable', 400)
    const readingGw = String(reading.gatewayId || '').trim().toUpperCase()
    const scaleGw = String(scale.gatewayId || '').trim().toUpperCase()
    if (readingGw && scaleGw && readingGw !== scaleGw) {
      throw new ProductionError('Scale reading gateway does not match scale assignment', 403)
    }
    const recorded = new Date(reading.recordedAt || reading.createdAt || 0).getTime()
    if (Number.isFinite(recorded) && Date.now() - recorded > STABLE_READING_MAX_AGE_MS) {
      throw new ProductionError('Stable scale reading has expired. Capture again.', 400)
    }
  } else if (allowLatestFallback) {
    const since = new Date(Date.now() - STABLE_READING_MAX_AGE_MS)
    reading = await HardwareEvent.findOne({
      scaleId: String(scaleId).toUpperCase(),
      stable: true,
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 })

    if (!reading) {
      throw new ProductionError(
        'No recent stable scale reading. Wait for STABLE on the gateway scale, then capture again.',
      )
    }
  } else {
    throw new ProductionError(
      'stableReadingId is required. Capture a stable scale reading before submitting.',
      400,
    )
  }

  const weight = Number(reading.weight)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ProductionError('Valid stable weight is required')
  }

  if (expectedWeight != null && Number.isFinite(Number(expectedWeight))) {
    if (Math.abs(Number(expectedWeight) - weight) > STABLE_WEIGHT_TOLERANCE_G) {
      throw new ProductionError(
        'Submitted weight does not match the captured stable scale reading',
        400,
      )
    }
  }

  return { scale, reading, weight }
}

/** Capture latest stable HardwareEvent for a scale — returns scaleReadingId. */
async function captureStableReading(scaleId, expectedWeight = null) {
  const { scale, reading, weight } = await assertScaleReading(scaleId, null, expectedWeight, {
    allowLatestFallback: true,
  })
  return {
    scaleReadingId: String(reading._id),
    scaleId: scale.scaleId,
    weight,
    unit: reading.unit || scale.unit || 'g',
    stable: true,
    recordedAt: reading.recordedAt || reading.createdAt,
    gatewayId: reading.gatewayId || scale.gatewayId || '',
  }
}

/**
 * Metal OUT: create pass (if needed) + issue — weight from scale reading.
 */
async function metalOut(req, body = {}) {
  const {
    passId = null,
    batchId,
    fromDepartment,
    toDepartment,
    purpose = '',
    scaleId,
    deviceId = '',
    stableReadingId = null,
    weight: clientWeight,
    operationId = null,
    allowManualWeight = false,
  } = body

  let weight
  let scaleMeta = null
  if (allowManualWeight && hasProductionPermission(req.user, 'adjustWeight')) {
    weight = Number(clientWeight)
    if (!Number.isFinite(weight) || weight <= 0) throw new ProductionError('Manual weight must be positive')
  } else {
    const asserted = await assertScaleReading(scaleId, stableReadingId, clientWeight, {
      requireId: true,
    })
    weight = asserted.weight
    scaleMeta = { scaleId: asserted.scale.scaleId, readingId: asserted.reading?._id, deviceId }
  }

  const idempotencyKey = operationId || null

  let pass
  let reused = false
  if (passId) {
    const issued = await passService.issuePass(req, passId, { idempotencyKey })
    pass = issued.pass
    reused = Boolean(issued.reused)
    return { type: 'metal_out', pass, movement: issued.movement, reused, scale: scaleMeta, weight: pass.weight }
  }

  if (!batchId || !toDepartment) {
    throw new ProductionError('batchId and toDepartment are required for Metal OUT')
  }

  const created = await passService.createPass(req, {
    batchId,
    fromDepartment,
    toDepartment,
    weight,
    purpose: purpose || 'MG Floor Metal OUT',
    idempotencyKey,
  })
  pass = created.pass
  reused = Boolean(created.reused)

  let movement = null
  if (!reused || pass.status === 'REQUESTED' || pass.status === 'APPROVED') {
    try {
      const approved = pass.status === 'REQUESTED'
        ? await passService.approvePass(req, pass._id)
        : { pass }
      const issued = await passService.issuePass(req, approved.pass._id || pass._id, { idempotencyKey })
      pass = issued.pass
      movement = issued.movement
      if (issued.reused) reused = true
    } catch (err) {
      // Pass may already be in transit from a prior sync — return created pass
      if (!/already|status/i.test(String(err.message || ''))) throw err
    }
  }

  return { type: 'metal_out', pass, movement, reused, scale: scaleMeta, weight }
}

/**
 * Metal IN: receive open pass with scale-captured weight.
 */
async function metalIn(req, body = {}) {
  const {
    passId,
    scaleId,
    deviceId = '',
    stableReadingId = null,
    receivedWeight: clientWeight,
    operationId = null,
    varianceReason = '',
    expectedBatchVersion,
    allowManualWeight = false,
    materials = null,
  } = body

  if (!passId) throw new ProductionError('passId is required for Metal IN')

  let weight
  let scaleMeta = null
  if (allowManualWeight && hasProductionPermission(req.user, 'adjustWeight')) {
    weight = Number(clientWeight)
    if (!Number.isFinite(weight) || weight <= 0) throw new ProductionError('Manual received weight invalid')
  } else {
    const asserted = await assertScaleReading(scaleId, stableReadingId, clientWeight, {
      requireId: true,
    })
    weight = asserted.weight
    scaleMeta = { scaleId: asserted.scale.scaleId, readingId: asserted.reading?._id, deviceId }
  }

  let materialsNormalized = null
  if (Array.isArray(materials) && materials.length) {
    materialsNormalized = materials
      .map((m) => ({
        code: String(m.code || '').trim(),
        label: String(m.label || m.code || '').trim(),
        weight: Number(m.weight),
      }))
      .filter((m) => m.code && Number.isFinite(m.weight) && m.weight >= 0)
    const sum = materialsNormalized.reduce((a, m) => a + m.weight, 0)
    if (Math.abs(sum - weight) > 0.5) {
      throw new ProductionError(
        `Materials total (${sum.toFixed(2)} g) must match received weight (${weight.toFixed(2)} g)`,
        400,
      )
    }
  }

  const result = await passService.receivePass(req, passId, {
    receivedWeight: weight,
    expectedBatchVersion,
    receiveIdempotencyKey: operationId || null,
    varianceReason,
  })

  return {
    type: 'metal_in',
    pass: result.pass,
    batch: result.batch,
    reused: Boolean(result.reused),
    scale: scaleMeta,
    weight,
    materials: materialsNormalized,
  }
}

/**
 * Transfer: create department-to-department pass (optionally issue).
 */
async function transfer(req, body = {}) {
  const {
    batchId,
    fromDepartment,
    toDepartment,
    purpose = '',
    scaleId,
    deviceId = '',
    stableReadingId = null,
    weight: clientWeight,
    operationId = null,
    autoIssue = true,
    allowManualWeight = false,
  } = body

  let weight
  let scaleMeta = null
  if (allowManualWeight && hasProductionPermission(req.user, 'adjustWeight')) {
    weight = Number(clientWeight)
    if (!Number.isFinite(weight) || weight <= 0) throw new ProductionError('Manual weight must be positive')
  } else {
    const asserted = await assertScaleReading(scaleId, stableReadingId, clientWeight, {
      requireId: true,
    })
    weight = asserted.weight
    scaleMeta = { scaleId: asserted.scale.scaleId, readingId: asserted.reading?._id, deviceId }
  }

  const created = await passService.createPass(req, {
    batchId,
    fromDepartment,
    toDepartment,
    weight,
    purpose: purpose || 'MG Floor Transfer',
    idempotencyKey: operationId || null,
  })

  let pass = created.pass
  let movement = null
  if (autoIssue && !created.reused) {
    try {
      if (pass.status === 'REQUESTED') {
        const approved = await passService.approvePass(req, pass._id)
        pass = approved.pass || pass
      }
      const issued = await passService.issuePass(req, pass._id, {})
      pass = issued.pass
      movement = issued.movement
    } catch (err) {
      if (!/permission|Insufficient/i.test(String(err.message || ''))) {
        // keep created pass if issue not allowed for role
      }
    }
  }

  return {
    type: 'transfer',
    pass,
    movement,
    reused: Boolean(created.reused),
    scale: scaleMeta,
    weight,
  }
}

async function ingestScaleReading(req, body = {}) {
  const {
    deviceType = 'weighing_scale',
    deviceId,
    scaleId,
    eventType = 'weight_reading',
    payload = {},
    recordedAt = null,
    idempotencyKey = null,
    gatewayId = '',
  } = body

  if (!deviceId) throw new ProductionError('deviceId is required')
  const normalizedScaleId = String(scaleId || payload.scaleId || deviceId || '').trim().toUpperCase()

  if (idempotencyKey) {
    const existing = await HardwareEvent.findOne({ idempotencyKey }).lean()
    if (existing) return { event: existing, reused: true }
  }

  await ensureDefaultScales()
  const scale = await Scale.findOne({ scaleId: normalizedScaleId })
  if (!scale) {
    throw new ProductionError(`Unknown or unregistered scale: ${normalizedScaleId}`, 403)
  }
  if (!scale.enabled) throw new ProductionError('Scale is disabled', 403)

  const authGatewayId = req.mgGateway?.gatewayId
  if (!authGatewayId) {
    throw new ProductionError('Gateway authentication required for scale ingest', 401)
  }
  assertGatewayOwnsDevice(scale.gatewayId, authGatewayId, `Scale ${normalizedScaleId}`)

  const weight = payload.weight != null ? Number(payload.weight) : Number(payload.grams)
  const stable = Boolean(payload.stable)
  const unit = String(payload.unit || scale.unit || 'g')
  const connectionType = String(payload.connectionType || scale.connectionType || '')
  const rawData = String(payload.rawData || '')

  const event = await HardwareEvent.create({
    deviceType,
    deviceId,
    scaleId: normalizedScaleId,
    gatewayId: gatewayId || scale.gatewayId || '',
    eventType,
    payload,
    weight: Number.isFinite(weight) ? weight : null,
    unit,
    stable,
    connectionType,
    rawData,
    recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    receivedAt: new Date(),
    receivedById: req.user?._id || null,
    idempotencyKey: idempotencyKey || null,
    status: 'accepted',
  })

  scale.lastWeight = Number.isFinite(weight) ? weight : scale.lastWeight
  scale.lastStable = stable
  scale.lastSeenAt = new Date()
  // Do not reassign gateway on ingest — ownership is fixed via admin assignment
  if (eventType === 'disconnect') scale.status = 'DISCONNECTED'
  else if (eventType === 'error') scale.status = 'ERROR'
  else if (!scale.enabled) scale.status = 'DISABLED'
  else if (stable) scale.status = 'STABLE'
  else scale.status = 'UNSTABLE'
  scale.lastError = eventType === 'error' ? String(payload.error || 'scale error') : ''
  await scale.save()

  return { event: event.toObject ? event.toObject() : event, scale, reused: false }
}

async function syncOperations(req, operations = []) {
  const results = []
  for (const op of operations) {
    const operationId = String(op.operationId || '').trim()
    if (!operationId) {
      results.push({ operationId: null, syncStatus: 'FAILED', errorMessage: 'operationId required' })
      continue
    }

    const existing = await FloorSyncOperation.findOne({ operationId })
    if (existing && existing.syncStatus === 'SYNCED') {
      results.push({
        operationId,
        syncStatus: 'SYNCED',
        result: existing.result,
        reused: true,
      })
      continue
    }

    const record = existing || new FloorSyncOperation({
      operationId,
      operationType: op.operationType || 'other',
      payload: op.payload || {},
      employeeId: req.user?._id,
      deviceId: op.deviceId || '',
      scaleId: op.scaleId || '',
      clientTimestamp: op.clientTimestamp ? new Date(op.clientTimestamp) : new Date(),
      syncStatus: 'SYNCING',
    })
    record.syncStatus = 'SYNCING'
    await record.save()

    try {
      let result
      const payload = { ...(op.payload || {}), operationId, deviceId: op.deviceId }
      switch (op.operationType) {
        case 'metal_in':
          result = await metalIn(req, payload)
          break
        case 'metal_out':
          result = await metalOut(req, payload)
          break
        case 'transfer':
          result = await transfer(req, payload)
          break
        case 'weight_adjust': {
          const batchId = payload.batchId
          if (!batchId) throw new ProductionError('batchId required for weight_adjust')
          result = await processService.adjustWeight(req, batchId, {
            ...payload,
            idempotencyKey: operationId,
          })
          break
        }
        case 'xrf_test':
          result = await xrf.submitXrfTest(req, payload)
          break
        case 'scan':
          result = { type: 'scan', skipped: true, message: 'scan sync is informational only' }
          break
        default:
          throw new ProductionError(`Unsupported operationType: ${op.operationType}`)
      }
      record.syncStatus = 'SYNCED'
      record.result = result
      record.syncedAt = new Date()
      record.errorMessage = ''
      await record.save()
      results.push({ operationId, syncStatus: 'SYNCED', result, reused: Boolean(result.reused) })
    } catch (err) {
      const conflict = /duplicate|idempoten|already/i.test(String(err.message || ''))
      record.syncStatus = conflict ? 'CONFLICT' : 'FAILED'
      record.errorMessage = String(err.message || 'sync failed')
      await record.save()
      results.push({
        operationId,
        syncStatus: record.syncStatus,
        errorMessage: record.errorMessage,
      })
    }
  }
  return results
}

async function registerDevice(req, body = {}) {
  const deviceId = String(body.deviceId || '').trim()
  if (!deviceId) throw new ProductionError('deviceId is required')
  const update = {
    deviceId,
    employeeId: req.user?._id || null,
    employeeName: req.user?.name || '',
    appVersion: body.appVersion || '',
    os: body.os || '',
    model: body.model || '',
    department: body.department || req.user?.department || '',
    status: 'active',
    lastSeenAt: new Date(),
    pushToken: body.pushToken || '',
  }
  const device = await FloorDevice.findOneAndUpdate(
    { deviceId },
    { $set: update },
    { upsert: true, new: true },
  )
  return device
}

function avgBucket(rows) {
  const count = rows.length
  const total = rows.reduce((a, r) => a + Number(r.weight || 0), 0)
  return {
    count,
    total,
    average: count ? total / count : 0,
  }
}

async function statsSummary(query = {}) {
  const filter = {}
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) filter.createdAt.$gte = new Date(query.from)
    if (query.to) filter.createdAt.$lte = new Date(query.to)
  }
  if (query.department) {
    filter.$or = [
      { fromDepartment: String(query.department) },
      { toDepartment: String(query.department) },
    ]
  }
  const rows = await MetalMovement.find(filter).select('weight receivedAt issuedAt status').lean()
  const metalIn = rows.filter((r) => r.receivedAt)
  const metalOut = rows.filter((r) => r.issuedAt && !r.receivedAt)
  return {
    metalIn: avgBucket(metalIn),
    metalOut: avgBucket(metalOut),
  }
}

async function raiseFloorAlert(req, body = {}) {
  const machineAlertService = require('../productionControl/machineAlertService')
  const alert = await machineAlertService.raiseAlert(req, {
    category: 'process',
    code: 'FLOOR_MANAGER_CALL',
    title: body.title,
    message: body.message || '',
    severity: body.severity || 'warning',
    batchId: body.batchId || null,
    batchNumber: body.batchNumber || '',
    metadata: {
      department: body.department || req.user?.department || '',
      operationId: body.operationId || null,
      source: 'mg-floor',
    },
  })
  return { alert }
}

module.exports = {
  DEFAULT_MG_SCALES,
  ensureDefaultScales,
  listScales,
  createScale,
  updateScale,
  listGateways,
  createGateway,
  updateGateway,
  listXrfAnalyzersPaged,
  createXrfAnalyzer,
  listDevicesForGateway,
  getMe,
  metalIn,
  metalOut,
  transfer,
  ingestScaleReading,
  syncOperations,
  registerDevice,
  assertScaleReading,
  captureStableReading,
  statsSummary,
  raiseFloorAlert,
  liveFloorService,
  departmentService,
  shiftService,
  flowConfigService,
  batchService,
  passService,
  processService,
  ...xrf,
}
