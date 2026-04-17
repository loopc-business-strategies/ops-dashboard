const mongoose = require('mongoose')

const metalRateSchema = new mongoose.Schema(
  {
    goldPrice: { type: Number, required: true, min: 0 },
    silverPrice: { type: Number, required: true, min: 0 },
    priceCurrency: { type: String, default: 'AED', trim: true, uppercase: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

metalRateSchema.index({ updatedAt: -1 })

module.exports = mongoose.model('MetalRate', metalRateSchema)
