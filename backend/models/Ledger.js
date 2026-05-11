const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const ledgerSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, default: Date.now, index: true },
    debitAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    creditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', required: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    referenceType: { type: String, enum: ['expense', 'invoice', 'payment', 'purchase', 'vendor_payment', 'journal', 'inventory', 'payroll', 'sale', 'receipt', 'cogs', 'reversal', 'direct_deal', 'vat_input', 'vat_output', 'bank_jv'], default: 'journal' },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String, default: '' },
    currency: { type: String, default: 'USD' },
    exchangeRate: { type: Number, default: 1 },
    notes: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    // Bank JV fields
    autoTxNo:       { type: String, default: '' },
    txRefNo:        { type: String, default: '' },
    chequeNo:       { type: String, default: '' },
    bankRemarks:    { type: String, default: '' },
    paymentType:    { type: String, enum: ['cash', 'bank', 'transfer', ''], default: '' },
    bankReconciled: { type: Boolean, default: false },
    attachmentUrl:  { type: String, default: '' },
    attachmentName: { type: String, default: '' },
  },
  { timestamps: true }
)

// Query performance indexes
ledgerSchema.index({ date: 1, debitAccountId: 1, creditAccountId: 1 })
ledgerSchema.index({ referenceType: 1, referenceId: 1 })
ledgerSchema.index({ debitAccountId: 1, date: -1 })
ledgerSchema.index({ creditAccountId: 1, date: -1 })
ledgerSchema.index({ isDeleted: 1, date: -1 })
ledgerSchema.index({ department: 1, date: -1 })
ledgerSchema.index({ bankReconciled: 1, referenceType: 1 })
ledgerSchema.index({ createdAt: -1 })

// No USD lock — currency and exchangeRate are set by the posting logic.

module.exports = createTenantModel('Ledger', ledgerSchema)
