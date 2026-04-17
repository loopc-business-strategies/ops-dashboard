const mongoose = require('mongoose')

const chartOfAccountSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, trim: true },
    accountCode: { type: String, required: true, trim: true },
    accountType: { type: String, enum: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'], required: true },
    parentAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
    currency: { type: String, default: 'AED' },
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

module.exports = mongoose.model('ChartOfAccount', chartOfAccountSchema)
