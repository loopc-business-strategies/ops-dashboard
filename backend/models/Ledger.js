const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const ledgerSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now, index: true },
    debitAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    creditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    referenceType: { type: String, enum: ['expense', 'invoice', 'payment', 'purchase', 'vendor_payment', 'journal', 'inventory', 'payroll', 'sale', 'receipt', 'cogs', 'reversal', 'direct_deal'], default: 'journal' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String, default: '' },
    currency: { type: String, default: 'USD' },
    exchangeRate: { type: Number, default: 1 },
    notes: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

ledgerSchema.index({ date: 1, debitAccountId: 1, creditAccountId: 1 })
ledgerSchema.index({ referenceType: 1, referenceId: 1 })

ledgerSchema.pre('validate', function enforceUsdCurrency(next) {
  this.currency = 'USD'
  this.exchangeRate = 1
  next()
})

module.exports = createTenantModel('Ledger', ledgerSchema)
