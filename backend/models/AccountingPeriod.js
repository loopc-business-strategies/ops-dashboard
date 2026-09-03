const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const accountingPeriodSchema = new mongoose.Schema(
  {
    periodType: {
      type: String,
      enum: ['MONTHLY', 'YEARLY'],
      required: true,
      index: true,
    },
    financialYear: { type: Number, required: true, index: true },
    // 1–12 for MONTHLY; null for YEARLY
    month: { type: Number, default: null, min: 1, max: 12 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reopenedAt: { type: Date, default: null },
    reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closeReason: { type: String, trim: true, default: '' },
    reopenReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

accountingPeriodSchema.index(
  { periodType: 1, financialYear: 1, month: 1 },
  { unique: true },
)
accountingPeriodSchema.index({ status: 1, startDate: 1, endDate: 1 })

module.exports = createTenantModel('AccountingPeriod', accountingPeriodSchema)
