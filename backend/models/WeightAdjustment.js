const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const weightAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: { type: String, required: true, trim: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', required: true },
    batchNumber: { type: String, trim: true, default: '' },
    field: {
      type: String,
      enum: ['currentWeight', 'issuedWeight', 'receivedWeight', 'processInputWeight', 'processOutputWeight', 'scrapWeight', 'lossWeight', 'recoveredWeight'],
      required: true,
    },
    originalValue: { type: Number, required: true },
    adjustment: { type: Number, required: true },
    newValue: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedByName: { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, trim: true, default: null },
  },
  { timestamps: true },
)

weightAdjustmentSchema.index({ adjustmentNumber: 1 }, { unique: true })
weightAdjustmentSchema.index({ batchId: 1, createdAt: -1 })
weightAdjustmentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

module.exports = createTenantModel('WeightAdjustment', weightAdjustmentSchema)
