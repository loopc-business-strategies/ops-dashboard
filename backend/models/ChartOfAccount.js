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
    address: { type: String, trim: true, default: '' },
    /** Tax Registration Number for the account party (shown on Account Summary). */
    trn: { type: String, trim: true, default: '' },
    /** Contact / authorized person for the account (shown on Account Summary). */
    authorizedPerson: { type: String, trim: true, default: '' },
    openingBalance: { type: Number, default: 0 },
    /** Required margin rate as a percent (5 = 5%). Drives Margin Amt on Account Summary. Default 0 until set. */
    marginPercent: { type: Number, default: 0, min: 0, max: 100 },
    department: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedInTransactions: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Query performance indexes
chartOfAccountSchema.index({ accountCode: 1 }, { unique: true })
chartOfAccountSchema.index({ accountType: 1, isActive: 1 })
chartOfAccountSchema.index({ parentAccountId: 1, isActive: 1 })
chartOfAccountSchema.index({ department: 1, isActive: 1 })
chartOfAccountSchema.index({ createdAt: -1 })

// No USD lock — currency is set by the account creation logic.

module.exports = createTenantModel('ChartOfAccount', chartOfAccountSchema)
