const mongoose = require('mongoose')
const XrfAnalyzer = require('../../models/XrfAnalyzer')
const XrfTest = require('../../models/XrfTest')
const { ProductionError } = require('../productionControl/errors')
const { writeProductionAudit } = require('../productionControl/audit')
const { AUDIT_ACTIONS } = require('../productionControl/constants')

const DEFAULT_MG_XRF = ['MG-XRF-001']

function allowXrfSimulator() {
  if (String(process.env.ALLOW_XRF_SIMULATOR || '').trim() === 'true') return true
  if (process.env.NODE_ENV === 'production') return false
  return String(process.env.ALLOW_XRF_SIMULATOR || '').trim() !== 'false'
}

async function ensureDefaultXrfAnalyzers() {
  for (const analyzerId of DEFAULT_MG_XRF) {
    await XrfAnalyzer.findOneAndUpdate(
      { analyzerId },
      {
        $setOnInsert: {
          analyzerId,
          manufacturer: 'LANScientific',
          model: '',
          connectionType: 'UNKNOWN',
          department: 'quality_control',
          enabled: true,
          status: 'DISCONNECTED',
          notes: 'Model/protocol configurable — confirm on device before enabling live communication.',
        },
      },
      { upsert: true, new: true },
    )
  }
  return XrfAnalyzer.find({}).sort({ analyzerId: 1 }).lean()
}

async function listXrfAnalyzers() {
  return ensureDefaultXrfAnalyzers()
}

async function getXrfAnalyzer(analyzerId) {
  await ensureDefaultXrfAnalyzers()
  const row = await XrfAnalyzer.findOne({ analyzerId: String(analyzerId || '').toUpperCase() }).lean()
  if (!row) throw new ProductionError('XRF analyzer not found', 404)
  return row
}

async function patchXrfAnalyzer(analyzerId, patch = {}) {
  const allowed = [
    'manufacturer', 'model', 'serialNumber', 'firmware', 'softwareVersion',
    'connectionType', 'usbId', 'bluetoothId', 'ipAddress', 'networkPort',
    'department', 'location', 'gatewayId', 'calibrationDate', 'nextCalibrationDate',
    'status', 'enabled', 'notes',
  ]
  const $set = {}
  for (const key of allowed) {
    if (patch[key] !== undefined) $set[key] = patch[key]
  }
  $set.lastSeenAt = new Date()
  const row = await XrfAnalyzer.findOneAndUpdate(
    { analyzerId: String(analyzerId || '').toUpperCase() },
    { $set },
    { new: true },
  )
  if (!row) throw new ProductionError('XRF analyzer not found', 404)
  return row
}

async function ingestXrfStatus(req, body = {}) {
  const analyzerId = String(body.analyzerId || '').toUpperCase()
  if (!analyzerId) throw new ProductionError('analyzerId is required')
  await ensureDefaultXrfAnalyzers()
  const analyzer = await XrfAnalyzer.findOne({ analyzerId })
  if (!analyzer || !analyzer.enabled) throw new ProductionError('XRF analyzer not found or disabled', 404)

  const eventType = String(body.eventType || 'status').toLowerCase()
  const status = String(body.status || '').toUpperCase()
  const known = ['CONNECTED', 'DISCONNECTED', 'ERROR', 'TESTING', 'READY', 'CALIBRATION_DUE', 'DISABLED']
  if (status && known.includes(status)) {
    analyzer.status = status
  } else if (eventType === 'disconnect') {
    analyzer.status = 'DISCONNECTED'
  } else if (eventType === 'error') {
    analyzer.status = 'ERROR'
  } else if (eventType === 'connected' || eventType === 'ready') {
    analyzer.status = 'READY'
  } else if (eventType === 'testing') {
    analyzer.status = 'TESTING'
  }
  analyzer.lastSeenAt = new Date()
  analyzer.gatewayId = body.gatewayId || req.mgGateway?.gatewayId || analyzer.gatewayId
  analyzer.lastError = eventType === 'error' ? String(body.error || body.payload?.error || 'xrf error') : ''
  if (body.model != null) analyzer.model = String(body.model)
  if (body.serialNumber != null) analyzer.serialNumber = String(body.serialNumber)
  if (body.firmware != null) analyzer.firmware = String(body.firmware)
  await analyzer.save()
  return { analyzer: analyzer.toObject ? analyzer.toObject() : analyzer }
}

function normalizeElements(elements) {
  if (!Array.isArray(elements)) return []
  return elements
    .map((e) => ({
      symbol: String(e.symbol || e.element || '').trim(),
      value: Number(e.value ?? e.percent ?? e.pct),
      unit: String(e.unit || '%').trim() || '%',
    }))
    .filter((e) => e.symbol && Number.isFinite(e.value))
}

/**
 * Gateway-only: create a hardware (or explicit simulated) result awaiting operator confirm.
 */
async function ingestXrfResult(req, body = {}) {
  const analyzerId = String(body.analyzerId || 'MG-XRF-001').toUpperCase()
  const sourceRaw = String(body.source || 'hardware').toLowerCase()
  const source = sourceRaw === 'simulated' ? 'simulated' : 'hardware'

  if (source === 'simulated' && !allowXrfSimulator()) {
    throw new ProductionError('Simulated XRF results are not allowed in this environment', 403)
  }

  const ingestId = body.ingestId
    ? String(body.ingestId).trim()
    : body.idempotencyKey
      ? String(body.idempotencyKey).trim()
      : null

  if (ingestId) {
    const existing = await XrfTest.findOne({ ingestId }).lean()
    if (existing) return { test: existing, reused: true }
  }

  await ensureDefaultXrfAnalyzers()
  const analyzer = await XrfAnalyzer.findOne({ analyzerId })
  if (!analyzer || !analyzer.enabled) throw new ProductionError('XRF analyzer not found or disabled', 404)

  const elements = normalizeElements(body.elements)
  const status = body.status || 'COMPLETED'
  if (!elements.length && !['ERROR', 'TIMEOUT', 'INVALID'].includes(status)) {
    throw new ProductionError('XRF result must include at least one element from the analyzer')
  }

  const gatewayId = body.gatewayId || req.mgGateway?.gatewayId || analyzer.gatewayId || ''
  const xrfTestId = String(body.xrfTestId || `XRF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim()

  const test = await XrfTest.create({
    xrfTestId,
    analyzerId,
    manufacturer: analyzer.manufacturer || body.manufacturer || 'LANScientific',
    model: analyzer.model || body.model || '',
    serialNumber: analyzer.serialNumber || body.serialNumber || '',
    employeeId: null,
    employeeName: '',
    department: analyzer.department || 'quality_control',
    testedAt: body.testedAt ? new Date(body.testedAt) : new Date(),
    elements,
    purity: body.purity != null && Number.isFinite(Number(body.purity)) ? Number(body.purity) : null,
    fineness: body.fineness != null && Number.isFinite(Number(body.fineness)) ? Number(body.fineness) : null,
    status,
    originalResult: body.originalResult || { elements, source },
    rawData: body.rawData || null,
    reportReference: body.reportReference || '',
    gatewayId,
    source,
    confirmationStatus: 'PENDING_CONFIRM',
    ingestId,
    syncStatus: 'SYNCED',
    idempotencyKey: ingestId,
  })

  analyzer.status = status === 'COMPLETED' ? 'READY' : analyzer.status
  analyzer.lastSeenAt = new Date()
  analyzer.gatewayId = gatewayId || analyzer.gatewayId
  await analyzer.save()

  return { test: test.toObject ? test.toObject() : test, reused: false }
}

/**
 * App path: confirm/link a gateway-ingested result. Does NOT accept invented elements.
 * Simulated creates only when ALLOW_XRF_SIMULATOR and explicit source=simulated (dev).
 */
async function submitXrfTest(req, body = {}) {
  const operationId = body.operationId ? String(body.operationId).trim() : null
  if (operationId) {
    const byOp = await XrfTest.findOne({ operationId }).lean()
    if (byOp) return { test: byOp, reused: true }
  }

  const xrfTestId = body.xrfTestId ? String(body.xrfTestId).trim() : ''
  const ingestId = body.ingestId ? String(body.ingestId).trim() : ''

  // Confirm existing gateway result
  if (xrfTestId || ingestId) {
    const test = xrfTestId
      ? await XrfTest.findOne({ xrfTestId })
      : await XrfTest.findOne({ ingestId })
    if (!test) throw new ProductionError('XRF test not found — wait for gateway ingest', 404)

    if (Array.isArray(body.elements) && body.elements.length) {
      throw new ProductionError(
        'Client cannot supply or override XRF element values. Confirm a gateway-ingested result only.',
        403,
      )
    }

    test.employeeId = req.user?._id || test.employeeId
    test.employeeName = req.user?.name || test.employeeName
    test.department = body.department || req.user?.department || test.department
    test.jobId = body.jobId != null ? String(body.jobId) : test.jobId
    test.batchId = body.batchId || test.batchId
    test.batchNumber = body.batchNumber != null ? String(body.batchNumber) : test.batchNumber
    test.materialId = body.materialId != null ? String(body.materialId) : test.materialId
    test.scaleId = body.scaleId != null ? String(body.scaleId) : test.scaleId
    test.scaleWeight = body.scaleWeight != null ? Number(body.scaleWeight) : test.scaleWeight
    test.deviceId = body.deviceId != null ? String(body.deviceId) : test.deviceId
    test.operationId = operationId || test.operationId
    test.confirmationStatus = 'CONFIRMED'
    test.syncStatus = 'SYNCED'
    await test.save()

    try {
      await writeProductionAudit(req, {
        resource: 'XrfTest',
        resourceId: test._id,
        action: AUDIT_ACTIONS.QC_SUBMITTED,
        detail: `XRF test ${test.xrfTestId} confirmed (${test.source})`,
        changes: {
          analyzerId: test.analyzerId,
          source: test.source,
          batchId: test.batchId,
          scaleId: test.scaleId,
          operationId: test.operationId,
        },
      })
    } catch {
      // ignore audit failure
    }

    return { test: test.toObject ? test.toObject() : test, reused: false }
  }

  // Dev-only simulated create (never production unless ALLOW_XRF_SIMULATOR=true)
  const wantsSim = String(body.source || '').toLowerCase() === 'simulated'
  if (!wantsSim) {
    throw new ProductionError(
      'XRF elements must come from an authorized gateway ingest. Provide xrfTestId from pending hardware results.',
      403,
    )
  }
  if (!allowXrfSimulator()) {
    throw new ProductionError('Simulated XRF results are not allowed in this environment', 403)
  }

  // Reuse ingest path for sim with gateway-less id
  const created = await ingestXrfResult(req, {
    ...body,
    source: 'simulated',
    gatewayId: body.gatewayId || 'MG-XRF-SIM',
    ingestId: operationId || body.ingestId || `sim-${Date.now()}`,
  })
  // Auto-confirm sim with operator metadata
  return submitXrfTest(req, {
    xrfTestId: created.test.xrfTestId,
    operationId,
    batchId: body.batchId,
    batchNumber: body.batchNumber,
    jobId: body.jobId,
    materialId: body.materialId,
    scaleId: body.scaleId,
    scaleWeight: body.scaleWeight,
    department: body.department,
    deviceId: body.deviceId,
  })
}

async function listXrfTests(query = {}) {
  const filter = {}
  if (query.analyzerId) filter.analyzerId = String(query.analyzerId).toUpperCase()
  if (query.batchId) filter.batchId = query.batchId
  if (query.source) filter.source = String(query.source)
  if (query.pendingForConfirm === '1' || query.pendingForConfirm === 'true') {
    filter.confirmationStatus = 'PENDING_CONFIRM'
  }
  const limit = Math.min(Number(query.limit) || 50, 200)
  const skip = Number(query.skip) || 0
  const tests = await XrfTest.find(filter).sort({ testedAt: -1 }).skip(skip).limit(limit).lean()
  const total = await XrfTest.countDocuments(filter)
  return { tests, total, limit, skip }
}

async function getXrfTest(id) {
  const byId = mongoose.Types.ObjectId.isValid(id)
    ? await XrfTest.findById(id).lean()
    : null
  const test = byId || await XrfTest.findOne({ xrfTestId: id }).lean()
  if (!test) throw new ProductionError('XRF test not found', 404)
  return test
}

module.exports = {
  DEFAULT_MG_XRF,
  allowXrfSimulator,
  ensureDefaultXrfAnalyzers,
  listXrfAnalyzers,
  getXrfAnalyzer,
  patchXrfAnalyzer,
  ingestXrfStatus,
  ingestXrfResult,
  submitXrfTest,
  listXrfTests,
  getXrfTest,
}
