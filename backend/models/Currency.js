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

currencySchema.pre('validate', function enforceUsdCurrency(next) {
  this.code = 'USD'
  this.name = 'US Dollar'
  this.symbol = '$'
  this.baseCurrency = true
  this.exchangeRate = 1
  this.isActive = true
  next()
})

module.exports = createTenantModel('Currency', currencySchema)
