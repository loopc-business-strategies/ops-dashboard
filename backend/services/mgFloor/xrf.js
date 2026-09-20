const mongoose = require('mongoose')
const XrfAnalyzer = require('../../models/XrfAnalyzer')
const XrfTest = require('../../models/XrfTest')
const { ProductionError } = require('../productionControl/errors')
const { writeProductionAudit } = require('../productionControl/audit')
const { AUDIT_ACTIONS } = require('../productionControl/constants')

const DEFAULT_MG_XRF = ['MG-XRF-001']

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
  analyzer.gatewayId = body.gatewayId || analyzer.gatewayId
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

async function submitXrfTest(req, body = {}) {
  const analyzerId = String(body.analyzerId || 'MG-XRF-001').toUpperCase()
  const operationId = body.operationId ? String(body.operationId).trim() : null
  const idempotencyKey = operationId || (body.idempotencyKey ? String(body.idempotencyKey).trim() : null)

  if (idempotencyKey) {
    const existing = await XrfTest.findOne({ idempotencyKey }).lean()
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

  const xrfTestId = String(body.xrfTestId || `XRF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim()
  const test = await XrfTest.create({
    xrfTestId,
    analyzerId,
    manufacturer: analyzer.manufacturer || body.manufacturer || 'LANScientific',
    model: analyzer.model || body.model || '',
    serialNumber: analyzer.serialNumber || body.serialNumber || '',
    employeeId: req.user?._id || null,
    employeeName: req.user?.name || '',
    department: body.department || req.user?.department || analyzer.department || '',
    jobId: body.jobId || '',
    batchId: body.batchId || null,
    batchNumber: body.batchNumber || '',
    materialId: body.materialId || '',
    testedAt: body.testedAt ? new Date(body.testedAt) : new Date(),
    elements,
    purity: body.purity != null && Number.isFinite(Number(body.purity)) ? Number(body.purity) : null,
    fineness: body.fineness != null && Number.isFinite(Number(body.fineness)) ? Number(body.fineness) : null,
    status,
    originalResult: body.originalResult || { elements },
    rawData: body.rawData || null,
    reportReference: body.reportReference || '',
    operationId,
    deviceId: body.deviceId || '',
    scaleId: body.scaleId || '',
    scaleWeight: body.scaleWeight != null ? Number(body.scaleWeight) : null,
    gatewayId: body.gatewayId || analyzer.gatewayId || '',
    syncStatus: 'SYNCED',
    idempotencyKey,
  })

  analyzer.status = 'READY'
  analyzer.lastSeenAt = new Date()
  await analyzer.save()

  try {
    await writeProductionAudit(req, {
      resource: 'XrfTest',
      resourceId: test._id,
      action: AUDIT_ACTIONS.QC_SUBMITTED,
      detail: `XRF test ${xrfTestId} on ${analyzerId}` + (test.batchNumber ? ` for ${test.batchNumber}` : ''),
      changes: {
        analyzerId,
        elements,
        batchId: test.batchId,
        scaleId: test.scaleId,
        scaleWeight: test.scaleWeight,
        operationId,
      },
    })
  } catch {
    // Audit must not block saving a valid analyzer result
  }

  return { test: test.toObject ? test.toObject() : test, reused: false }
}

async function listXrfTests(query = {}) {
  const filter = {}
  if (query.analyzerId) filter.analyzerId = String(query.analyzerId).toUpperCase()
  if (query.batchId) filter.batchId = query.batchId
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
  ensureDefaultXrfAnalyzers,
  listXrfAnalyzers,
  getXrfAnalyzer,
  patchXrfAnalyzer,
  ingestXrfStatus,
  submitXrfTest,
  listXrfTests,
  getXrfTest,
}
