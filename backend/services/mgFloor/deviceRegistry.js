const Scale = require('../../models/Scale')
const XrfAnalyzer = require('../../models/XrfAnalyzer')
const FloorGateway = require('../../models/FloorGateway')
const { ProductionError } = require('../productionControl/errors')

const DEFAULT_MG_SCALES = [
  'MG-SCALE-001',
  'MG-SCALE-002',
  'MG-SCALE-003',
  'MG-SCALE-004',
  'MG-SCALE-005',
  'MG-SCALE-006',
  'MG-SCALE-007',
]

const DEFAULT_GATEWAY_ID = 'MG-GATEWAY-001'

const SCALE_PATCH_FIELDS = [
  'name', 'manufacturer', 'model', 'serialNumber', 'connectionType', 'port',
  'baudRate', 'dataBits', 'parity', 'stopBits', 'ipAddress', 'bluetoothId',
  'networkPort', 'department', 'location', 'unit', 'precision',
  'calibrationDate', 'nextCalibrationDate', 'gatewayId', 'enabled', 'status', 'notes',
]

async function seedDefaultScales() {
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
          gatewayId: DEFAULT_GATEWAY_ID,
        },
        $set: {
          // Ensure seed scales stay assigned to default gateway when empty
        },
      },
      { upsert: true, new: true },
    )
    await Scale.updateOne(
      { scaleId, $or: [{ gatewayId: '' }, { gatewayId: null }, { gatewayId: { $exists: false } }] },
      { $set: { gatewayId: DEFAULT_GATEWAY_ID } },
    )
  }
}

async function seedDefaultsIfEmpty() {
  const count = await Scale.countDocuments()
  if (count > 0) return { seeded: false, count }
  await seedDefaultScales()
  return { seeded: true, count: await Scale.countDocuments() }
}

/** @deprecated Prefer seedDefaultsIfEmpty + listScales. Kept for call-site compatibility. */
async function ensureDefaultScales() {
  await seedDefaultsIfEmpty()
  return listScales({ limit: 500 }).then((r) => r.scales)
}

function buildScaleFilter(query = {}) {
  const filter = {}
  if (query.enabled === 'true' || query.enabled === true) filter.enabled = true
  if (query.enabled === 'false' || query.enabled === false) filter.enabled = false
  if (query.status) filter.status = String(query.status).toUpperCase()
  if (query.department) filter.department = String(query.department)
  if (query.gatewayId) filter.gatewayId = String(query.gatewayId).toUpperCase()
  if (query.connectionType) filter.connectionType = String(query.connectionType).toUpperCase()
  if (query.search) {
    const q = String(query.search).trim()
    if (q) {
      filter.$or = [
        { scaleId: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { model: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { serialNumber: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { department: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ]
    }
  }
  return filter
}

async function listScales(query = {}) {
  // Only seed when the collection is empty (no-op afterward — not 7 upserts per GET)
  await seedDefaultsIfEmpty()
  const filter = buildScaleFilter(query)
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500)
  const skip = Math.max(Number(query.skip) || 0, 0)
  const [scales, total] = await Promise.all([
    Scale.find(filter).sort({ scaleId: 1 }).skip(skip).limit(limit).lean(),
    Scale.countDocuments(filter),
  ])
  return { scales, total, limit, skip }
}

async function createScale(body = {}) {
  const scaleId = String(body.scaleId || '').trim().toUpperCase()
  if (!scaleId) throw new ProductionError('scaleId is required')
  if (!/^MG-SCALE-\d{3,}$/i.test(scaleId) && !/^MG-[A-Z0-9-]+$/i.test(scaleId)) {
    // Allow MG-SCALE-NNN+ or other MG-* ids
  }
  const gatewayId = String(body.gatewayId || '').trim().toUpperCase()
  if (!gatewayId) {
    throw new ProductionError('gatewayId is required when creating a scale (assign before ingest)')
  }

  const existing = await Scale.findOne({ scaleId }).lean()
  if (existing) throw new ProductionError(`Scale already exists: ${scaleId}`, 409)

  await ensureDefaultGateways()

  const scale = await Scale.create({
    scaleId,
    name: body.name || scaleId,
    manufacturer: body.manufacturer || 'Ming Heng',
    model: body.model || 'MH-708',
    serialNumber: body.serialNumber || '',
    connectionType: body.connectionType || 'RS232',
    port: body.port || '',
    baudRate: body.baudRate != null ? Number(body.baudRate) : 9600,
    dataBits: body.dataBits != null ? Number(body.dataBits) : 8,
    parity: body.parity || 'none',
    stopBits: body.stopBits != null ? Number(body.stopBits) : 1,
    ipAddress: body.ipAddress || '',
    bluetoothId: body.bluetoothId || '',
    department: body.department || '',
    location: body.location || '',
    unit: body.unit || 'g',
    precision: body.precision != null ? Number(body.precision) : 2,
    calibrationDate: body.calibrationDate || null,
    nextCalibrationDate: body.nextCalibrationDate || null,
    gatewayId,
    enabled: body.enabled !== false,
    status: body.enabled === false ? 'DISABLED' : 'DISCONNECTED',
  })
  return scale.toObject ? scale.toObject() : scale
}

async function updateScale(scaleIdRaw, body = {}) {
  const scaleId = String(scaleIdRaw || '').toUpperCase()
  const scale = await Scale.findOne({ scaleId })
  if (!scale) throw new ProductionError('Scale not found', 404)

  for (const key of SCALE_PATCH_FIELDS) {
    if (body[key] !== undefined) {
      if (key === 'gatewayId') scale.gatewayId = String(body.gatewayId || '').trim().toUpperCase()
      else if (key === 'scaleId') continue
      else scale[key] = body[key]
    }
  }
  if (scale.enabled === false) scale.status = 'DISABLED'
  else if (scale.status === 'DISABLED' && scale.enabled === true) scale.status = 'DISCONNECTED'
  await scale.save()
  return scale.toObject ? scale.toObject() : scale
}

function assertGatewayOwnsDevice(deviceGatewayId, authGatewayId, deviceLabel) {
  const assigned = String(deviceGatewayId || '').trim().toUpperCase()
  const auth = String(authGatewayId || '').trim().toUpperCase()
  if (!assigned) {
    throw new ProductionError(
      `${deviceLabel} has no gateway assignment — assign gatewayId before ingest`,
      403,
    )
  }
  if (!auth || assigned !== auth) {
    const err = new ProductionError(
      `Device is assigned to ${assigned}, not ${auth || 'unknown'}`,
      403,
    )
    err.code = 'DEVICE_GATEWAY_MISMATCH'
    throw err
  }
}

async function ensureDefaultGateways() {
  await FloorGateway.findOneAndUpdate(
    { gatewayId: DEFAULT_GATEWAY_ID },
    {
      $setOnInsert: {
        gatewayId: DEFAULT_GATEWAY_ID,
        name: 'Primary MG Floor Gateway',
        enabled: true,
      },
    },
    { upsert: true, new: true },
  )
}

async function listGateways(query = {}) {
  await ensureDefaultGateways()
  const filter = {}
  if (query.enabled === 'true' || query.enabled === true) filter.enabled = true
  if (query.enabled === 'false' || query.enabled === false) filter.enabled = false
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 200)
  const skip = Math.max(Number(query.skip) || 0, 0)
  const [gateways, total] = await Promise.all([
    FloorGateway.find(filter).sort({ gatewayId: 1 }).skip(skip).limit(limit).lean(),
    FloorGateway.countDocuments(filter),
  ])
  return { gateways, total, limit, skip }
}

async function createGateway(body = {}) {
  const gatewayId = String(body.gatewayId || '').trim().toUpperCase()
  if (!gatewayId) throw new ProductionError('gatewayId is required')
  const existing = await FloorGateway.findOne({ gatewayId }).lean()
  if (existing) throw new ProductionError(`Gateway already exists: ${gatewayId}`, 409)
  const row = await FloorGateway.create({
    gatewayId,
    name: body.name || gatewayId,
    location: body.location || '',
    notes: body.notes || '',
    enabled: body.enabled !== false,
  })
  return row.toObject ? row.toObject() : row
}

async function updateGateway(gatewayIdRaw, body = {}) {
  const gatewayId = String(gatewayIdRaw || '').toUpperCase()
  const row = await FloorGateway.findOne({ gatewayId })
  if (!row) throw new ProductionError('Gateway not found', 404)
  for (const key of ['name', 'location', 'notes', 'enabled']) {
    if (body[key] !== undefined) row[key] = body[key]
  }
  await row.save()
  return row.toObject ? row.toObject() : row
}

async function listXrfAnalyzersPaged(query = {}) {
  const { ensureDefaultXrfAnalyzers } = require('./xrf')
  await ensureDefaultXrfAnalyzers()
  const filter = {}
  if (query.enabled === 'true' || query.enabled === true) filter.enabled = true
  if (query.enabled === 'false' || query.enabled === false) filter.enabled = false
  if (query.gatewayId) filter.gatewayId = String(query.gatewayId).toUpperCase()
  if (query.search) {
    const q = String(query.search).trim()
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ analyzerId: re }, { name: re }, { model: re }, { serialNumber: re }]
    }
  }
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500)
  const skip = Math.max(Number(query.skip) || 0, 0)
  const [analyzers, total] = await Promise.all([
    XrfAnalyzer.find(filter).sort({ analyzerId: 1 }).skip(skip).limit(limit).lean(),
    XrfAnalyzer.countDocuments(filter),
  ])
  return { analyzers, total, limit, skip }
}

async function createXrfAnalyzer(body = {}) {
  const { ensureDefaultXrfAnalyzers } = require('./xrf')
  await ensureDefaultXrfAnalyzers()
  const analyzerId = String(body.analyzerId || '').trim().toUpperCase()
  if (!analyzerId) throw new ProductionError('analyzerId is required')
  const gatewayId = String(body.gatewayId || '').trim().toUpperCase()
  if (!gatewayId) throw new ProductionError('gatewayId is required when creating an XRF analyzer')
  const existing = await XrfAnalyzer.findOne({ analyzerId }).lean()
  if (existing) throw new ProductionError(`XRF analyzer already exists: ${analyzerId}`, 409)
  const row = await XrfAnalyzer.create({
    analyzerId,
    manufacturer: body.manufacturer || 'LANScientific',
    model: body.model || '',
    serialNumber: body.serialNumber || '',
    connectionType: body.connectionType || 'UNKNOWN',
    department: body.department || 'quality_control',
    location: body.location || '',
    gatewayId,
    enabled: body.enabled !== false,
    status: 'DISCONNECTED',
    notes: body.notes || '',
  })
  return row.toObject ? row.toObject() : row
}

/**
 * Gateway-auth: devices assigned to this gateway for driver bootstrap.
 */
async function listDevicesForGateway(gatewayIdRaw) {
  const gatewayId = String(gatewayIdRaw || '').trim().toUpperCase()
  if (!gatewayId) throw new ProductionError('gatewayId is required')
  await seedDefaultsIfEmpty()
  await ensureDefaultGateways()
  const { ensureDefaultXrfAnalyzers } = require('./xrf')
  await ensureDefaultXrfAnalyzers()

  const [scales, analyzers, gateway] = await Promise.all([
    Scale.find({ gatewayId, enabled: true }).sort({ scaleId: 1 }).lean(),
    XrfAnalyzer.find({ gatewayId, enabled: true }).sort({ analyzerId: 1 }).lean(),
    FloorGateway.findOne({ gatewayId }).lean(),
  ])

  return {
    gatewayId,
    gateway: gateway || { gatewayId, enabled: true },
    scales: scales.map((s) => ({
      scaleId: s.scaleId,
      name: s.name,
      manufacturer: s.manufacturer,
      model: s.model,
      serialNumber: s.serialNumber,
      connectionType: s.connectionType,
      port: s.port,
      baudRate: s.baudRate,
      dataBits: s.dataBits,
      parity: s.parity,
      stopBits: s.stopBits,
      ipAddress: s.ipAddress,
      networkPort: s.networkPort,
      bluetoothId: s.bluetoothId,
      department: s.department,
      location: s.location,
      unit: s.unit,
      precision: s.precision,
      enabled: s.enabled,
      gatewayId: s.gatewayId,
    })),
    xrfAnalyzers: analyzers.map((a) => ({
      analyzerId: a.analyzerId,
      manufacturer: a.manufacturer,
      model: a.model,
      serialNumber: a.serialNumber,
      connectionType: a.connectionType,
      usbId: a.usbId,
      bluetoothId: a.bluetoothId,
      ipAddress: a.ipAddress,
      networkPort: a.networkPort,
      department: a.department,
      location: a.location,
      enabled: a.enabled,
      gatewayId: a.gatewayId,
    })),
  }
}

module.exports = {
  DEFAULT_MG_SCALES,
  DEFAULT_GATEWAY_ID,
  seedDefaultScales,
  seedDefaultsIfEmpty,
  ensureDefaultScales,
  listScales,
  createScale,
  updateScale,
  assertGatewayOwnsDevice,
  ensureDefaultGateways,
  listGateways,
  createGateway,
  updateGateway,
  listXrfAnalyzersPaged,
  createXrfAnalyzer,
  listDevicesForGateway,
}
