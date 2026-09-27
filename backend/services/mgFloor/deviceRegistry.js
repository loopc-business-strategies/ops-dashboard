const Scale = require('../../models/Scale')
const XrfAnalyzer = require('../../models/XrfAnalyzer')
const FloorGateway = require('../../models/FloorGateway')
const { ProductionError } = require('../productionControl/errors')
const {
  SCALE_CAPTURE_METHODS,
  OVER_CAPACITY_POLICIES,
  MIN_CAMERA_OCR_CONFIDENCE,
  CAMERA_OCR_TUNING_LIMITS,
} = require('../../constants/mgFloorWeightCapture')

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

const NOT_ARCHIVED = { $ne: true }

const CAMERA_OCR_LIMITS = {
  minConfidence: [MIN_CAMERA_OCR_CONFIDENCE, 1],
  consecutiveFrames: [2, 30],
  stableDurationMs: [0, 30000],
  allowedVariation: [0, 100],
  imageQuality: [0.2, 1],
  ...CAMERA_OCR_TUNING_LIMITS,
}

/** Seeding the MH-708 defaults is opt-in so an emptied registry stays empty. */
function shouldSeedDefaultScales() {
  return String(process.env.MG_FLOOR_SEED_DEFAULT_SCALES || '').trim().toLowerCase() === 'true'
}

function resolveCaptureMethods(scale) {
  const methods = Array.isArray(scale?.captureMethods) ? scale.captureMethods.filter(Boolean) : []
  return methods.length ? methods : ['DIGITAL_RS232']
}

function normalizeCaptureMethods(raw) {
  if (raw == null) return null
  const list = (Array.isArray(raw) ? raw : [raw])
    .map((m) => String(m || '').trim().toUpperCase())
    .filter(Boolean)
  const invalid = list.filter((m) => !SCALE_CAPTURE_METHODS.includes(m))
  if (invalid.length) {
    throw new ProductionError(`Unsupported capture method: ${invalid.join(', ')}`, 400)
  }
  const unique = [...new Set(list)]
  if (!unique.length) throw new ProductionError('At least one capture method is required', 400)
  return unique
}

function normalizePositiveOrNull(value, label) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new ProductionError(`${label} must be a positive number`, 400)
  return n
}

function normalizeCameraOcr(raw, current = {}) {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ProductionError('cameraOcr must be an object', 400)
  }
  const base = current && typeof current.toObject === 'function' ? current.toObject() : { ...(current || {}) }
  const next = { ...base }
  for (const [key, [min, max]] of Object.entries(CAMERA_OCR_LIMITS)) {
    if (raw[key] === undefined) continue
    const n = Number(raw[key])
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new ProductionError(`cameraOcr.${key} must be between ${min} and ${max}`, 400)
    }
    next[key] = key === 'consecutiveFrames' || key === 'stableDurationMs' ? Math.round(n) : n
  }
  for (const key of ['enabled', 'sevenSegmentCrossCheck']) {
    if (raw[key] !== undefined) next[key] = Boolean(raw[key])
  }
  if (raw.overCapacityPolicy !== undefined) {
    const policy = String(raw.overCapacityPolicy || '').trim().toUpperCase()
    if (!OVER_CAPACITY_POLICIES.includes(policy)) {
      throw new ProductionError('cameraOcr.overCapacityPolicy must be REJECT or REVIEW', 400)
    }
    next.overCapacityPolicy = policy
  }
  return next
}

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
  if (!shouldSeedDefaultScales()) return { seeded: false, count: null }
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
  if (!(query.includeArchived === 'true' || query.includeArchived === true)) filter.archived = NOT_ARCHIVED
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
  const connectionType = String(body.connectionType || '').trim().toUpperCase()
  const captureMethods = normalizeCaptureMethods(body.captureMethods)
    || (connectionType === 'CAMERA' ? ['CAMERA_OCR'] : ['DIGITAL_RS232'])
  const usesDigital = captureMethods.includes('DIGITAL_RS232')
  const cameraOnly = !usesDigital

  const gatewayId = String(body.gatewayId || '').trim().toUpperCase()
  if (usesDigital && !gatewayId) {
    throw new ProductionError('gatewayId is required when creating a scale (assign before ingest)')
  }

  const existing = await Scale.findOne({ scaleId })
  if (existing && !existing.archived) throw new ProductionError(`Scale already exists: ${scaleId}`, 409)

  if (gatewayId) await ensureDefaultGateways()

  // Camera-only scales carry no serial settings — never invent RS-232 values for them.
  const serialNumberOrNull = (value, fallback) => {
    if (value != null && value !== '') return Number(value)
    return cameraOnly ? null : fallback
  }

  const profile = {
    scaleId,
    name: body.name || scaleId,
    manufacturer: body.manufacturer || (cameraOnly ? '' : 'Ming Heng'),
    model: body.model || (cameraOnly ? '' : 'MH-708'),
    serialNumber: body.serialNumber || '',
    connectionType: connectionType || (cameraOnly ? 'CAMERA' : 'RS232'),
    port: body.port || '',
    baudRate: serialNumberOrNull(body.baudRate, 9600),
    dataBits: serialNumberOrNull(body.dataBits, 8),
    parity: body.parity || (cameraOnly ? '' : 'none'),
    stopBits: serialNumberOrNull(body.stopBits, 1),
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
    captureMethods,
    capacity: normalizePositiveOrNull(body.capacity, 'capacity') ?? null,
    resolution: normalizePositiveOrNull(body.resolution, 'resolution') ?? null,
    cameraOcr: normalizeCameraOcr(body.cameraOcr || {}, {}),
    archived: false,
    archivedAt: null,
    archivedBy: null,
    archiveReason: '',
  }

  if (existing) {
    // Re-creating an archived scaleId restores it with the new profile (history stays linked by scaleId).
    existing.set(profile)
    existing.lastWeight = null
    existing.lastStable = false
    existing.lastError = ''
    await existing.save()
    return existing.toObject ? existing.toObject() : existing
  }

  const scale = await Scale.create(profile)
  return scale.toObject ? scale.toObject() : scale
}

async function archiveScale(scaleIdRaw, { reason, user } = {}) {
  const scaleId = String(scaleIdRaw || '').trim().toUpperCase()
  const why = String(reason || '').trim()
  if (why.length < 3) throw new ProductionError('A reason is required to remove a scale', 400)
  const scale = await Scale.findOne({ scaleId })
  if (!scale) throw new ProductionError('Scale not found', 404)
  if (scale.archived) return { scale: scale.toObject ? scale.toObject() : scale, reused: true }
  scale.archived = true
  scale.archivedAt = new Date()
  scale.archivedBy = user?._id || null
  scale.archiveReason = why
  scale.enabled = false
  scale.status = 'DISABLED'
  await scale.save()
  return { scale: scale.toObject ? scale.toObject() : scale, reused: false }
}

async function updateScale(scaleIdRaw, body = {}) {
  const scaleId = String(scaleIdRaw || '').toUpperCase()
  const scale = await Scale.findOne({ scaleId })
  if (!scale) throw new ProductionError('Scale not found', 404)
  if (scale.archived) {
    throw new ProductionError('Scale has been removed. Add it again to restore it.', 409)
  }

  const captureMethods = normalizeCaptureMethods(body.captureMethods)
  if (captureMethods) scale.captureMethods = captureMethods
  const capacity = normalizePositiveOrNull(body.capacity, 'capacity')
  if (capacity !== undefined) scale.capacity = capacity
  const resolution = normalizePositiveOrNull(body.resolution, 'resolution')
  if (resolution !== undefined) scale.resolution = resolution
  const cameraOcr = normalizeCameraOcr(body.cameraOcr, scale.cameraOcr)
  if (cameraOcr) scale.cameraOcr = cameraOcr

  for (const key of SCALE_PATCH_FIELDS) {
    if (body[key] !== undefined) {
      if (key === 'gatewayId') scale.gatewayId = String(body.gatewayId || '').trim().toUpperCase()
      else if (key === 'scaleId') continue
      else scale[key] = body[key]
    }
  }
  if (scale.enabled === false) scale.status = 'DISABLED'
  else if (scale.status === 'DISABLED' && scale.enabled === true) scale.status = 'DISCONNECTED'
  if (resolveCaptureMethods(scale).includes('DIGITAL_RS232') && !scale.gatewayId) {
    throw new ProductionError('gatewayId is required for scales with DIGITAL_RS232 capture', 400)
  }
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
    Scale.find({ gatewayId, enabled: true, archived: NOT_ARCHIVED }).sort({ scaleId: 1 }).lean(),
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
  shouldSeedDefaultScales,
  resolveCaptureMethods,
  listScales,
  createScale,
  updateScale,
  archiveScale,
  assertGatewayOwnsDevice,
  ensureDefaultGateways,
  listGateways,
  createGateway,
  updateGateway,
  listXrfAnalyzersPaged,
  createXrfAnalyzer,
  listDevicesForGateway,
}
