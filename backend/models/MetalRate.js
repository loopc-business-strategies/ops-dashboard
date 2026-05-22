const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const metalRateSchema = new mongoose.Schema(
  {
    goldPrice: { type: Number, required: true, min: 0 },
    silverPrice: { type: Number, required: true, min: 0 },
    platinumPrice: { type: Number, default: 0, min: 0 },
    priceCurrency: { type: String, default: 'USD', trim: true, uppercase: true },
    priceUnit: { type: String, default: 'G', trim: true, uppercase: true },
    source: { type: String, default: 'manual', trim: true },
    sourcePayload: { type: mongoose.Schema.Types.Mixed, default: undefined },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

metalRateSchema.index({ updatedAt: -1 })

module.exports = createTenantModel('MetalRate', metalRateSchema)
