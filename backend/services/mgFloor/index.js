const Scale = require('../../models/Scale')
const HardwareEvent = require('../../models/HardwareEvent')
const FloorDevice = require('../../models/FloorDevice')
const FloorSyncOperation = require('../../models/FloorSyncOperation')
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

const DEFAULT_MG_SCALES = [
  'MG-SCALE-001',
  'MG-SCALE-002',
  'MG-SCALE-003',
  'MG-SCALE-004',
  'MG-SCALE-005',
  'MG-SCALE-006',
  'MG-SCALE-007',
]

async function ensureDefaultScales() {
  for (const scaleId of DEFAULT_MG_SCALES) {
    await Scale.findOneAndUpdate(
      { scaleId },
      {
        $setOnInsert: {
          scaleId,
          name: scaleId,
          manufacturer: 'Ming Heng',
          model: 'MH-708',
          connectionType: 'RS232',
          unit: 'g',
          enabled: true,
          status: 'DISCONNECTED',
        },
      },
      { upsert: true, new: true },
    )
  }
  return Scale.find({ scaleId: { $in: DEFAULT_MG_SCALES } }).sort({ scaleId: 1 }).lean()
}

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

async function assertScaleReading(scaleId, stableReadingId, expectedWeight) {
  if (!scaleId) throw new ProductionError('scaleId is required for floor weight capture')
  const scale = await Scale.findOne({ scaleId: String(scaleId).toUpperCase() })
  if (!scale || !scale.enabled) throw new ProductionError('Scale not found or disabled', 404)
  if (scale.status === 'DISABLED') throw new ProductionError('Scale is disabled')

  let reading = null
  if (stableReadingId) {
    reading = await HardwareEvent.findById(stableReadingId)
    if (!reading) throw new ProductionError('Stable scale reading not found', 404)
    if (String(reading.scaleId || '').toUpperCase() !== String(scaleId).toUpperCase()) {
      throw new ProductionError('Scale reading does not match scaleId')
    }
    if (!reading.stable) throw new ProductionError('Scale reading is not stable')
  } else {
    // Prefer the latest stable reading within 2 minutes for this scale
    const since = new Date(Date.now() - 2 * 60 * 1000)
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
  }

  const weight = Number(reading.weight)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ProductionError('Valid stable weight is required')
  }

  // Optional sanity check vs client-displayed weight (tolerance 0.5g)
  if (expectedWeight != null && Number.isFinite(Number(expectedWeight))) {
    if (Math.abs(Number(expectedWeight) - weight) > 0.5) {
      throw new ProductionError('Displayed weight does not match latest stable scale reading')
    }
  }

  return { scale, reading, weight }
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
    const asserted = await assertScaleReading(scaleId, stableReadingId, clientWeight)
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
  } = body

  if (!passId) throw new ProductionError('passId is required for Metal IN')

  let weight
  let scaleMeta = null
  if (allowManualWeight && hasProductionPermission(req.user, 'adjustWeight')) {
    weight = Number(clientWeight)
    if (!Number.isFinite(weight) || weight < 0) throw new ProductionError('Manual received weight invalid')
  } else {
    const asserted = await assertScaleReading(scaleId, stableReadingId, clientWeight)
    weight = asserted.weight
    scaleMeta = { scaleId: asserted.scale.scaleId, readingId: asserted.reading?._id, deviceId }
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
    const asserted = await assertScaleReading(scaleId, stableReadingId, clientWeight)
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
  scale.gatewayId = gatewayId || scale.gatewayId
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

module.exports = {
  DEFAULT_MG_SCALES,
  ensureDefaultScales,
  getMe,
  metalIn,
  metalOut,
  transfer,
  ingestScaleReading,
  syncOperations,
  registerDevice,
  assertScaleReading,
  liveFloorService,
  departmentService,
  shiftService,
  flowConfigService,
  batchService,
  passService,
  processService,
  ...xrf,
}
