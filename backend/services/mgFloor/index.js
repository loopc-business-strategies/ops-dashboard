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
const batchEntries = require('./batchEntries')
const { normalizeFloorDepartment } = require('../../constants/mgFloorBatchEntry')

/**
 * Offline operation types from older tablet builds (scale / camera capture, XRF, pass-based
 * Metal IN / OUT / Transfer). MG Floor is manual entry + Floor Manager approval only.
 */
const REMOVED_OPERATION_TYPES = new Set(['metal_in', 'metal_out', 'transfer', 'xrf_test', 'weight_capture'])

async function getMe(req) {
  const shift = await shiftService.getCurrentShift().catch(() => null)
  return {
    productionRole: resolveProductionRole(req.user),
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      department: req.user.department,
      floorDepartment: normalizeFloorDepartment(req.user.floorDepartment),
      productionRole: resolveProductionRole(req.user),
    },
    shift,
    permissions: {
      metalIn: hasProductionPermission(req.user, 'receivePass'),
      metalOut: hasProductionPermission(req.user, 'createPass'),
      approveBatches: hasProductionPermission(req.user, 'approvePass'),
      adjustWeight: hasProductionPermission(req.user, 'adjustWeight'),
      viewAudit: hasProductionPermission(req.user, 'viewAudit'),
    },
  }
}

async function syncOperations(req, operations = []) {
  const results = []
  for (const op of operations) {
    const operationId = String(op.operationId || '').trim()
    if (!operationId) {
      results.push({ operationId: null, syncStatus: 'FAILED', errorMessage: 'operationId required' })
      continue
    }

    if (REMOVED_OPERATION_TYPES.has(op.operationType)) {
      results.push({
        operationId,
        syncStatus: 'FAILED',
        code: 'FEATURE_REMOVED',
        errorMessage: `${op.operationType} is no longer supported. Use manual batch entry.`,
      })
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
      clientTimestamp: op.clientTimestamp ? new Date(op.clientTimestamp) : new Date(),
      syncStatus: 'SYNCING',
    })
    record.syncStatus = 'SYNCING'
    await record.save()

    try {
      let result
      const payload = { ...(op.payload || {}), operationId, deviceId: op.deviceId }
      switch (op.operationType) {
        case 'weight_adjust': {
          const batchId = payload.batchId
          if (!batchId) throw new ProductionError('batchId required for weight_adjust')
          result = await processService.adjustWeight(req, batchId, {
            ...payload,
            idempotencyKey: operationId,
          })
          break
        }
        case 'batch_entry': {
          const sent = await batchEntries.submitBatchEntry(req, {
            ...(op.payload || {}),
            deviceId: op.payload?.deviceId || op.deviceId,
          })
          result = {
            type: 'batch_entry',
            entryId: sent.entry.entryId,
            status: sent.entry.status,
            reused: sent.reused,
          }
          break
        }
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
        code: err.code || undefined,
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
  REMOVED_OPERATION_TYPES,
  getMe,
  syncOperations,
  registerDevice,
  statsSummary,
  raiseFloorAlert,
  liveFloorService,
  departmentService,
  shiftService,
  flowConfigService,
  batchService,
  passService,
  processService,
}
