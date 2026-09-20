const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const elementSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, trim: true },
    value: { type: Number, required: true },
    unit: { type: String, trim: true, default: '%' },
  },
  { _id: false },
)

const xrfTestSchema = new mongoose.Schema(
  {
    xrfTestId: { type: String, required: true, trim: true },
    analyzerId: { type: String, required: true, trim: true, uppercase: true },
    manufacturer: { type: String, trim: true, default: 'LANScientific' },
    model: { type: String, trim: true, default: '' },
    serialNumber: { type: String, trim: true, default: '' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    jobId: { type: String, trim: true, default: '' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', default: null },
    batchNumber: { type: String, trim: true, default: '' },
    materialId: { type: String, trim: true, default: '' },
    testedAt: { type: Date, default: Date.now },
    elements: { type: [elementSchema], default: [] },
    purity: { type: Number, default: null },
    fineness: { type: Number, default: null },
    status: {
      type: String,
      enum: ['COMPLETED', 'INVALID', 'ERROR', 'TIMEOUT', 'PENDING'],
      default: 'COMPLETED',
    },
    originalResult: { type: mongoose.Schema.Types.Mixed, default: null },
    rawData: { type: mongoose.Schema.Types.Mixed, default: null },
    reportReference: { type: String, trim: true, default: '' },
    operationId: { type: String, trim: true, default: null },
    deviceId: { type: String, trim: true, default: '' },
    scaleId: { type: String, trim: true, default: '' },
    scaleWeight: { type: Number, default: null },
    gatewayId: { type: String, trim: true, default: '' },
    source: {
      type: String,
      enum: ['hardware', 'simulated'],
      default: 'hardware',
    },
    confirmationStatus: {
      type: String,
      enum: ['PENDING_CONFIRM', 'CONFIRMED', 'REJECTED'],
      default: 'PENDING_CONFIRM',
    },
    ingestId: { type: String, trim: true, default: null },
    syncStatus: {
      type: String,
      enum: ['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT'],
      default: 'SYNCED',
    },
    idempotencyKey: { type: String, trim: true, default: null },
  },
  { timestamps: true },
)

xrfTestSchema.index({ xrfTestId: 1 }, { unique: true })
xrfTestSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })
xrfTestSchema.index({ ingestId: 1 }, { unique: true, sparse: true })
xrfTestSchema.index({ analyzerId: 1, confirmationStatus: 1, testedAt: -1 })
xrfTestSchema.index({ analyzerId: 1, testedAt: -1 })
xrfTestSchema.index({ batchId: 1, testedAt: -1 })
xrfTestSchema.index({ operationId: 1 }, { sparse: true })

module.exports = createTenantModel('XrfTest', xrfTestSchema)
