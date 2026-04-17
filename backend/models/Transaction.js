const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    description: { type: String, trim: true, default: '' },
    currency: { type: String, trim: true, default: 'AED' },
    exchangeRate: { type: Number, default: 1 },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },

    debitAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
    creditAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
    mappingId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountMapping', default: null },

    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'posted'],
      default: 'draft',
      index: true,
    },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

transactionSchema.index({ type: 1, date: -1 })

module.exports = mongoose.model('Transaction', transactionSchema)
