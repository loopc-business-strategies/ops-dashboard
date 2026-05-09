const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { ACCOUNT_TYPES } = require('../constants/accountTypes')

const chartOfAccountSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, trim: true },
    accountCode: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ACCOUNT_TYPES, required: true },
    parentAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
    currency: { type: String, default: 'USD' },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: '' },
    openingBalance: { type: Number, default: 0 },
    department: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedInTransactions: { type: Boolean, default: false },
  },
  { timestamps: true }
)

chartOfAccountSchema.index({ accountCode: 1 }, { unique: true })
chartOfAccountSchema.index({ accountType: 1 })
chartOfAccountSchema.index({ isActive: 1 })

// No USD lock — currency is set by the account creation logic.

module.exports = createTenantModel('ChartOfAccount', chartOfAccountSchema)
