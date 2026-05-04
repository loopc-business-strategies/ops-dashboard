const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const currencySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    symbol: { type: String, required: true, trim: true },
    baseCurrency: { type: Boolean, default: false },
    exchangeRate: { type: Number, required: true, default: 1 },
    rateUpdatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Note: no USD-lock hook — multiple currencies are supported.
// The base currency (baseCurrency: true) is managed by the routes layer
// so only one currency can be the base at a time.
module.exports = createTenantModel('Currency', currencySchema)
