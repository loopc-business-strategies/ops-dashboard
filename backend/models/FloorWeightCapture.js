const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { WEIGHT_CAPTURE_METHODS } = require('../constants/mgFloorWeightCapture')

const CAPTURE_STATUSES = ['CONFIRMED', 'CONSUMED']
const PHOTO_STATUSES = ['NONE', 'PENDING', 'UPLOADED']

const photoSchema = new mongoose.Schema(
  {
    status: { type: String, enum: PHOTO_STATUSES, default: 'PENDING' },
    storageDriver: { type: String, trim: true, default: '' },
    storageKey: { type: String, trim: true, default: '' },
    fileName: { type: String, trim: true, default: '' },
    mimeType: { type: String, trim: true, default: '' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false },
)

const consumedBySchema = new mongoose.Schema(
  {
    operationType: { type: String, trim: true, default: '' },
    operationId: { type: String, trim: true, default: '' },
    passId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionPass', default: null },
    movementId: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalMovement', default: null },
    at: { type: Date, default: null },
  },
  { _id: false },
)

/**
 * Operator-confirmed weight from SCALE CAMERA (OCR) or MANUAL entry.
 * Digital RS-232 readings remain HardwareEvent / scaleReadingId and are never stored here.
 */
const floorWeightCaptureSchema = new mongoose.Schema(
  {
    captureId: { type: String, required: true, trim: true },
    scaleId: { type: String, required: true, trim: true, uppercase: true },
    scaleModel: { type: String, trim: true, default: '' },
    scaleManufacturer: { type: String, trim: true, default: '' },
    weight: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, default: 'g' },
    captureMethod: { type: String, enum: WEIGHT_CAPTURE_METHODS, required: true },
    ocrConfidence: { type: Number, default: null },
    ocrRawText: { type: String, trim: true, default: '' },
    crossCheckAgreed: { type: Boolean, default: null },
    stable: { type: Boolean, default: false },
    stableFrames: { type: Number, default: 0 },
    overCapacityReview: { type: Boolean, default: false },
    manualReason: { type: String, trim: true, default: '' },
    photo: { type: photoSchema, default: () => ({}) },
    deviceId: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, trim: true, default: '' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', default: null },
    batchNumber: { type: String, trim: true, default: '' },
    passId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionPass', default: null },
    capturedAt: { type: Date, required: true },
    receivedAt: { type: Date, default: () => new Date() },
    status: { type: String, enum: CAPTURE_STATUSES, default: 'CONFIRMED' },
    consumedBy: { type: consumedBySchema, default: null },
  },
  { timestamps: true },
)

floorWeightCaptureSchema.index({ captureId: 1 }, { unique: true })
floorWeightCaptureSchema.index({ scaleId: 1, createdAt: -1 })
floorWeightCaptureSchema.index({ employeeId: 1, createdAt: -1 })
floorWeightCaptureSchema.index({ status: 1, createdAt: -1 })
floorWeightCaptureSchema.index({ 'consumedBy.passId': 1 }, { sparse: true })

module.exports = createTenantModel('FloorWeightCapture', floorWeightCaptureSchema)
