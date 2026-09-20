const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const hardwareEventSchema = new mongoose.Schema(
  {
    deviceType: { type: String, required: true, trim: true },
    deviceId: { type: String, required: true, trim: true },
    scaleId: { type: String, trim: true, default: '' },
    gatewayId: { type: String, trim: true, default: '' },
    eventType: { type: String, required: true, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    weight: { type: Number, default: null },
    unit: { type: String, trim: true, default: 'g' },
    stable: { type: Boolean, default: false },
    connectionType: { type: String, trim: true, default: '' },
    rawData: { type: String, trim: true, default: '' },
    recordedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: Date.now },
    receivedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    idempotencyKey: { type: String, trim: true, default: null },
    status: { type: String, trim: true, default: 'accepted' },
  },
  { timestamps: true },
)

hardwareEventSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })
hardwareEventSchema.index({ scaleId: 1, createdAt: -1 })
hardwareEventSchema.index({ deviceId: 1, createdAt: -1 })
hardwareEventSchema.index({ eventType: 1, createdAt: -1 })

module.exports = createTenantModel('HardwareEvent', hardwareEventSchema)
