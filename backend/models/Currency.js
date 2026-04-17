const mongoose = require('mongoose')

const currencySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, // AED, USD, EUR, etc.
    name: { type: String, required: true, trim: true },
    symbol: { type: String, required: true, trim: true },
    baseCurrency: { type: Boolean, default: false },
    exchangeRate: { type: Number, required: true, default: 1 }, // relative to base
    rateUpdatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Currency', currencySchema)
