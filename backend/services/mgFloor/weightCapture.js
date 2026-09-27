const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const Scale = require('../../models/Scale')
const FloorWeightCapture = require('../../models/FloorWeightCapture')
const ProductionPass = require('../../models/ProductionPass')
const { ProductionError } = require('../productionControl/errors')
const { hasProductionPermission } = require('../productionControl/permissions')
const { writeProductionAudit } = require('../productionControl/audit')
const { createDiskUpload, resolveUploadDir } = require('../erpAccounting/uploadMiddleware')
const { storeUploadedAttachment, sendStoredAttachment } = require('../erpAccounting/attachmentStorageService')
const {
  CAMERA_OCR_DEFAULTS,
  DEFAULT_CAMERA_SCALE,
  MIN_CAMERA_OCR_CONFIDENCE,
  WEIGHT_CAPTURE_METHODS,
} = require('../../constants/mgFloorWeightCapture')
const { createScale, resolveCaptureMethods } = require('./deviceRegistry')

const PHOTO_BUCKET = 'mgFloorScaleCapturePhotos'
const CAPTURE_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/
const WEIGHT_TOLERANCE_G = Number(process.env.MG_STABLE_WEIGHT_TOLERANCE_G || 0.5)
const CAPTURE_MAX_AGE_MS = Number(process.env.MG_WEIGHT_CAPTURE_MAX_AGE_MS || 24 * 60 * 60 * 1000)
/** Sanity bound for REVIEW policy — a reading this far above capacity is a misread, not an overload. */
const OVER_CAPACITY_HARD_LIMIT_RATIO = 1.1
const CLOCK_SKEW_MS = 5 * 60 * 1000

const photoUploadDir = resolveUploadDir('MG_FLOOR_CAPTURE_UPLOAD_DIR', 'mg-floor-captures')

const photoUpload = createDiskUpload({
  dir: photoUploadDir,
  prefix: 'scale-capture',
  maxBytes: Number(process.env.MG_FLOOR_CAPTURE_PHOTO_MAX_BYTES || 2 * 1024 * 1024),
  allowedMimeTypes: ['image/jpeg', 'image/jpg'],
  typeError: 'Scale capture photo must be a JPEG image',
})

function normDept(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function assertCaptureId(captureId) {
  const id = String(captureId || '').trim()
  if (!CAPTURE_ID_PATTERN.test(id)) {
    throw new ProductionError('captureId must be 8-120 characters (letters, digits, - or _)', 400)
  }
  return id
}

function optionalObjectId(value, label) {
  if (value == null || value === '') return null
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    throw new ProductionError(`${label} is not a valid id`, 400)
  }
  return new mongoose.Types.ObjectId(String(value))
}

function cameraSettingsFor(scale) {
  const raw = scale?.cameraOcr && typeof scale.cameraOcr.toObject === 'function'
    ? scale.cameraOcr.toObject()
    : (scale?.cameraOcr || {})
  return { ...CAMERA_OCR_DEFAULTS, ...raw }
}

function isMultipleOfResolution(weight, resolution) {
  if (!resolution || resolution <= 0) return true
  const steps = weight / resolution
  return Math.abs(steps - Math.round(steps)) < 1e-6
}

function canCaptureWeight(user) {
  return hasProductionPermission(user, 'receivePass') || hasProductionPermission(user, 'createPass')
}

function canReviewAllCaptures(user) {
  return hasProductionPermission(user, 'viewAudit') || hasProductionPermission(user, 'manageMachines')
}

async function loadActiveScale(scaleIdRaw) {
  const scaleId = String(scaleIdRaw || '').trim().toUpperCase()
  if (!scaleId) throw new ProductionError('scaleId is required', 400)
  const scale = await Scale.findOne({ scaleId })
  if (!scale || scale.archived || !scale.enabled || scale.status === 'DISABLED') {
    throw new ProductionError('Scale not found or disabled', 404)
  }
  return scale
}

/**
 * Like loadActiveScale, but provisions the built-in camera scale the first time it is used so
 * camera capture works before any scale is registered. An existing (archived/disabled) record is
 * never recreated here — that stays a manager decision.
 */
async function loadCaptureScale(req, scaleIdRaw, captureMethod) {
  const scaleId = String(scaleIdRaw || '').trim().toUpperCase()
  if (captureMethod !== 'CAMERA_OCR' || scaleId !== DEFAULT_CAMERA_SCALE.scaleId) {
    return loadActiveScale(scaleId)
  }
  if (!(await Scale.exists({ scaleId }))) {
    try {
      const created = await createScale({ ...DEFAULT_CAMERA_SCALE, captureMethods: [...DEFAULT_CAMERA_SCALE.captureMethods] })
      await writeProductionAudit(req, {
        resource: 'Scale',
        resourceId: created._id,
        action: 'mg_floor_default_camera_scale_created',
        detail: `Built-in camera scale ${scaleId} created on first camera capture`,
        changes: { ...DEFAULT_CAMERA_SCALE },
      }).catch((err) => console.warn('[mg-floor] default camera scale audit failed', err?.message || err))
    } catch (err) {
      // A concurrent first capture created it; fall through and load that record.
      if (!(err instanceof ProductionError && err.status === 409) && err?.code !== 11000) throw err
    }
  }
  return loadActiveScale(scaleId)
}

/**
 * Validate a weight against the scale profile. Shared by create and exposed for tests.
 * @returns {{ overCapacityReview: boolean }}
 */
function validateWeightForScale(scale, weight, { reviewAcknowledged = false } = {}) {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ProductionError('Weight must be a positive number', 400)
  }
  const resolution = Number(scale.resolution) || null
  if (!isMultipleOfResolution(weight, resolution)) {
    throw new ProductionError(`Weight ${weight} does not match scale resolution ${resolution}`, 400)
  }
  const capacity = Number(scale.capacity) || null
  if (!capacity || weight <= capacity) return { overCapacityReview: false }

  const policy = cameraSettingsFor(scale).overCapacityPolicy
  if (policy !== 'REVIEW' || weight > capacity * OVER_CAPACITY_HARD_LIMIT_RATIO) {
    const err = new ProductionError(`Weight ${weight} g exceeds scale capacity ${capacity} g`, 400)
    err.code = 'WEIGHT_OUT_OF_RANGE'
    throw err
  }
  if (!reviewAcknowledged) {
    const err = new ProductionError(
      `Weight ${weight} g is above capacity ${capacity} g — operator review is required`,
      400,
    )
    err.code = 'WEIGHT_REVIEW_REQUIRED'
    throw err
  }
  return { overCapacityReview: true }
}

function sameCapturePayload(existing, { scaleId, weight, captureMethod }) {
  return existing.scaleId === scaleId
    && Math.abs(Number(existing.weight) - weight) < 1e-9
    && existing.captureMethod === captureMethod
}

async function createWeightCapture(req, body = {}) {
  const user = req.user
  if (!canCaptureWeight(user)) {
    throw new ProductionError('Insufficient production permission to capture weight', 403)
  }

  const captureId = assertCaptureId(body.captureId)
  const captureMethod = String(body.captureMethod || '').trim().toUpperCase()
  if (!WEIGHT_CAPTURE_METHODS.includes(captureMethod)) {
    throw new ProductionError('captureMethod must be CAMERA_OCR or MANUAL', 400)
  }
  const weight = Number(body.weight)
  const scaleId = String(body.scaleId || '').trim().toUpperCase()

  const existing = await FloorWeightCapture.findOne({ captureId })
  if (existing) {
    if (!sameCapturePayload(existing, { scaleId, weight, captureMethod })) {
      const err = new ProductionError('captureId was already used for a different weight capture', 409)
      err.code = 'CAPTURE_ID_CONFLICT'
      throw err
    }
    return { capture: existing.toObject(), reused: true }
  }

  const scale = await loadCaptureScale(req, scaleId, captureMethod)

  if (scale.department && user?.department && !hasProductionPermission(user, 'manageMachines')
    && normDept(scale.department) !== normDept(user.department)) {
    throw new ProductionError(`Scale ${scale.scaleId} is assigned to ${scale.department}`, 403)
  }

  const unit = String(body.unit || 'g').trim().toLowerCase()
  const scaleUnit = String(scale.unit || 'g').trim().toLowerCase()
  if (unit !== scaleUnit) {
    throw new ProductionError(`Unit ${unit} does not match scale unit ${scaleUnit}`, 400)
  }

  const settings = cameraSettingsFor(scale)
  let ocrConfidence = null
  let manualReason = ''

  if (captureMethod === 'CAMERA_OCR') {
    if (!resolveCaptureMethods(scale).includes('CAMERA_OCR') || settings.enabled === false) {
      throw new ProductionError(`Scale camera capture is not enabled for ${scale.scaleId}`, 403)
    }
    if (body.stable !== true) {
      throw new ProductionError('Camera reading must be stable before it can be confirmed', 400)
    }
    ocrConfidence = Number(body.ocrConfidence)
    if (!Number.isFinite(ocrConfidence) || ocrConfidence < 0 || ocrConfidence > 1) {
      throw new ProductionError('ocrConfidence must be between 0 and 1', 400)
    }
    const requiredConfidence = Math.max(MIN_CAMERA_OCR_CONFIDENCE, Number(settings.minConfidence) || 0)
    if (ocrConfidence < requiredConfidence) {
      const err = new ProductionError(
        `OCR confidence ${(ocrConfidence * 100).toFixed(0)}% is below the required ${(requiredConfidence * 100).toFixed(0)}%`,
        400,
      )
      err.code = 'LOW_OCR_CONFIDENCE'
      throw err
    }
  } else {
    if (!hasProductionPermission(user, 'adjustWeight')) {
      throw new ProductionError('Manual weight entry requires the adjustWeight permission', 403)
    }
    manualReason = String(body.manualReason || '').trim()
    if (manualReason.length < 3) {
      throw new ProductionError('A reason is required for manual weight entry', 400)
    }
  }

  const { overCapacityReview } = validateWeightForScale(scale, weight, {
    reviewAcknowledged: body.reviewAcknowledged === true,
  })

  const now = Date.now()
  let capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date(now)
  if (Number.isNaN(capturedAt.getTime()) || capturedAt.getTime() > now + CLOCK_SKEW_MS) {
    capturedAt = new Date(now)
  }

  const doc = {
    captureId,
    scaleId: scale.scaleId,
    scaleModel: scale.model || '',
    scaleManufacturer: scale.manufacturer || '',
    weight,
    unit: scaleUnit,
    captureMethod,
    ocrConfidence,
    ocrRawText: captureMethod === 'CAMERA_OCR' ? String(body.ocrRawText || '').slice(0, 64) : '',
    crossCheckAgreed: typeof body.crossCheckAgreed === 'boolean' ? body.crossCheckAgreed : null,
    stable: captureMethod === 'CAMERA_OCR' ? true : false,
    stableFrames: Math.max(0, Math.round(Number(body.stableFrames) || 0)),
    overCapacityReview,
    manualReason,
    photo: { status: body.hasPhoto === false ? 'NONE' : 'PENDING' },
    deviceId: String(body.deviceId || '').trim().slice(0, 120),
    department: String(body.department || user?.department || scale.department || '').trim(),
    employeeId: user?._id || null,
    employeeName: user?.name || '',
    batchId: optionalObjectId(body.batchId, 'batchId'),
    batchNumber: String(body.batchNumber || '').trim().slice(0, 80),
    passId: optionalObjectId(body.passId, 'passId'),
    capturedAt,
    receivedAt: new Date(now),
    status: 'CONFIRMED',
  }

  let created
  try {
    created = await FloorWeightCapture.create(doc)
  } catch (err) {
    if (err?.code === 11000) {
      const again = await FloorWeightCapture.findOne({ captureId })
      if (again && sameCapturePayload(again, doc)) return { capture: again.toObject(), reused: true }
      throw new ProductionError('captureId was already used for a different weight capture', 409)
    }
    throw err
  }

  await writeProductionAudit(req, {
    resource: 'FloorWeightCapture',
    resourceId: created._id,
    action: captureMethod === 'MANUAL' ? 'mg_floor_manual_weight_captured' : 'mg_floor_camera_weight_captured',
    detail: `${weight.toFixed(2)} ${scaleUnit} on ${scale.scaleId} via ${captureMethod}`,
    changes: {
      captureId,
      scaleId: scale.scaleId,
      scaleModel: doc.scaleModel,
      weight,
      unit: scaleUnit,
      captureMethod,
      ocrConfidence,
      crossCheckAgreed: doc.crossCheckAgreed,
      overCapacityReview,
      manualReason: manualReason || undefined,
      deviceId: doc.deviceId,
      department: doc.department,
      batchId: doc.batchId,
      capturedAt,
    },
  }).catch((err) => console.warn('[mg-floor] weight capture audit failed', err?.message || err))

  return { capture: created.toObject(), reused: false }
}

async function findCaptureForUser(req, captureIdRaw) {
  const captureId = assertCaptureId(captureIdRaw)
  const capture = await FloorWeightCapture.findOne({ captureId })
  if (!capture) throw new ProductionError('Weight capture not found', 404)
  const own = capture.employeeId && req.user?._id && String(capture.employeeId) === String(req.user._id)
  if (!own && !canReviewAllCaptures(req.user)) {
    throw new ProductionError('Not allowed to view this weight capture', 403)
  }
  return capture
}

function discardTempFile(file) {
  if (file?.path && fs.existsSync(file.path)) {
    try { fs.unlinkSync(file.path) } catch { /* ignore */ }
  }
}

async function attachCapturePhoto(req, captureIdRaw, file) {
  if (!file) throw new ProductionError('photo file is required', 400)
  let capture
  try {
    capture = await findCaptureForUser(req, captureIdRaw)
  } catch (err) {
    discardTempFile(file)
    throw err
  }
  if (capture.photo?.status === 'UPLOADED') {
    discardTempFile(file)
    return { capture: capture.toObject(), reused: true }
  }

  const stored = await storeUploadedAttachment({
    req,
    file,
    user: req.user,
    model: FloorWeightCapture,
    relativePathPrefix: `/api/mg-floor/scale-camera-captures/${capture.captureId}/photo`,
    bucketName: PHOTO_BUCKET,
    metadata: { captureId: capture.captureId, scaleId: capture.scaleId },
  })

  capture.photo = {
    status: 'UPLOADED',
    storageDriver: stored.storageDriver,
    storageKey: stored.storageKey,
    fileName: stored.fileName,
    mimeType: stored.mimeType,
    size: stored.size,
    uploadedAt: new Date(),
  }
  await capture.save()
  return { capture: capture.toObject(), reused: false }
}

async function sendCapturePhoto(req, res, captureIdRaw) {
  const capture = await findCaptureForUser(req, captureIdRaw)
  if (capture.photo?.status !== 'UPLOADED') {
    return res.status(404).json({ success: false, message: 'Photo not uploaded yet' })
  }
  const localFilePath = capture.photo.storageDriver === 'gridfs'
    ? null
    : path.resolve(photoUploadDir, path.basename(capture.photo.storageKey || ''))
  res.setHeader('Content-Type', capture.photo.mimeType || 'image/jpeg')
  res.setHeader('Cache-Control', 'private, max-age=3600')
  return sendStoredAttachment({
    res,
    attachment: capture.photo,
    transactionModel: FloorWeightCapture,
    localFilePath,
    bucketName: PHOTO_BUCKET,
  })
}

async function listWeightCaptures(req, query = {}) {
  const filter = {}
  if (!canReviewAllCaptures(req.user)) filter.employeeId = req.user?._id || null
  if (query.scaleId) filter.scaleId = String(query.scaleId).toUpperCase()
  if (query.captureMethod) filter.captureMethod = String(query.captureMethod).toUpperCase()
  if (query.status) filter.status = String(query.status).toUpperCase()
  if (query.from || query.to) {
    filter.capturedAt = {}
    if (query.from) filter.capturedAt.$gte = new Date(query.from)
    if (query.to) filter.capturedAt.$lte = new Date(query.to)
  }
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  const skip = Math.max(Number(query.skip) || 0, 0)
  const [captures, total] = await Promise.all([
    FloorWeightCapture.find(filter).sort({ capturedAt: -1 }).skip(skip).limit(limit).lean(),
    FloorWeightCapture.countDocuments(filter),
  ])
  return { captures, total, limit, skip }
}

async function getWeightCapture(req, captureId) {
  const capture = await findCaptureForUser(req, captureId)
  return capture.toObject()
}

/**
 * Single-use lock of a confirmed capture for one metal operation.
 * Retrying the same operationId is allowed; a different operation gets 409.
 */
async function consumeWeightCapture(req, {
  weightCaptureId,
  scaleId,
  expectedWeight,
  operationId,
  operationType,
}) {
  const captureId = assertCaptureId(weightCaptureId)
  const opId = String(operationId || '').trim()
  if (!opId) throw new ProductionError('operationId is required when submitting a captured weight', 400)

  const scale = await loadActiveScale(scaleId)
  const capture = await FloorWeightCapture.findOne({ captureId })
  if (!capture) {
    const err = new ProductionError('Weight capture not found. Sync the capture before the transaction.', 404)
    err.code = 'WEIGHT_CAPTURE_NOT_FOUND'
    throw err
  }
  if (capture.scaleId !== scale.scaleId) {
    throw new ProductionError('Weight capture does not match scaleId', 403)
  }
  const weight = Number(capture.weight)
  if (expectedWeight != null && Number.isFinite(Number(expectedWeight))
    && Math.abs(Number(expectedWeight) - weight) > WEIGHT_TOLERANCE_G) {
    throw new ProductionError('Submitted weight does not match the confirmed weight capture', 400)
  }
  const capturedAt = new Date(capture.capturedAt || capture.createdAt || 0).getTime()
  if (capture.status === 'CONFIRMED' && Number.isFinite(capturedAt) && Date.now() - capturedAt > CAPTURE_MAX_AGE_MS) {
    throw new ProductionError('Weight capture has expired. Capture the weight again.', 400)
  }

  const assertOwnedBy = (row) => {
    if (row.status === 'CONSUMED' && row.consumedBy?.operationId !== opId) {
      const err = new ProductionError('This weight capture was already used by another transaction', 409)
      err.code = 'WEIGHT_CAPTURE_ALREADY_USED'
      throw err
    }
  }

  assertOwnedBy(capture)
  let locked = capture
  if (capture.status === 'CONFIRMED') {
    locked = await FloorWeightCapture.findOneAndUpdate(
      { _id: capture._id, status: 'CONFIRMED' },
      { $set: { status: 'CONSUMED', consumedBy: { operationType, operationId: opId, at: new Date() } } },
      { returnDocument: 'after' },
    )
    if (!locked) {
      locked = await FloorWeightCapture.findById(capture._id)
      assertOwnedBy(locked)
    }
  }

  return { scale, capture: locked, weight }
}

/** Undo a lock when the metal operation failed before anything was written. */
async function releaseWeightCapture(captureId, operationId) {
  if (!captureId || !operationId) return
  await FloorWeightCapture.updateOne(
    { captureId, status: 'CONSUMED', 'consumedBy.operationId': operationId, 'consumedBy.passId': null },
    { $set: { status: 'CONFIRMED', consumedBy: null } },
  ).catch(() => {})
}

/** Store which captured weight a pass issue/receive used; also back-link the capture. */
async function recordPassWeightCapture(req, { pass, field, ref, movementId = null }) {
  if (!pass?._id || !ref) return
  await ProductionPass.updateOne({ _id: pass._id }, { $set: { [field]: ref } }).catch((err) => {
    console.warn('[mg-floor] pass weight capture link failed', err?.message || err)
  })
  if (ref.weightCaptureId) {
    await FloorWeightCapture.updateOne(
      { captureId: ref.weightCaptureId, 'consumedBy.operationId': ref.operationId },
      { $set: { 'consumedBy.passId': pass._id, 'consumedBy.movementId': movementId || pass.movementId || null } },
    ).catch(() => {})
  }
  await writeProductionAudit(req, {
    resource: 'ProductionPass',
    resourceId: pass._id,
    action: field === 'receiveWeightCapture' ? 'mg_floor_metal_in_weight_source' : 'mg_floor_metal_out_weight_source',
    detail: `${ref.method} ${Number(ref.weight).toFixed(2)} g on ${ref.scaleId}`,
    changes: { ...ref, passNumber: pass.passNumber, batchId: pass.batchId },
  }).catch(() => {})
}

module.exports = {
  PHOTO_BUCKET,
  photoUpload,
  photoUploadDir,
  createWeightCapture,
  attachCapturePhoto,
  sendCapturePhoto,
  listWeightCaptures,
  getWeightCapture,
  consumeWeightCapture,
  releaseWeightCapture,
  recordPassWeightCapture,
  validateWeightForScale,
  cameraSettingsFor,
}
