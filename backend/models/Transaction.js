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
      enum: ['draft', 'submitted', 'approved', 'posted', 'returned', 'rejected'],
      default: 'draft',
      index: true,
    },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    comments: [
      {
        message: { type: String, trim: true, required: true },
        kind: { type: String, enum: ['comment', 'submit_note', 'approval_note', 'posting_note', 'return_note', 'reject_note'], default: 'comment' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    attachments: [
      {
        originalName: { type: String, trim: true, required: true },
        fileName: { type: String, trim: true, required: true },
        relativePath: { type: String, trim: true, required: true },
        url: { type: String, trim: true, required: true },
        mimeType: { type: String, trim: true, default: 'application/octet-stream' },
        size: { type: Number, default: 0 },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    auditTrail: [
      {
        action: { type: String, required: true, trim: true },
        fromStatus: { type: String, default: '' },
        toStatus: { type: String, default: '' },
        comment: { type: String, trim: true, default: '' },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Voucher-specific metadata (Payment Voucher / Receipt Voucher)
    voucherMeta: {
      branch: { type: String, trim: true, default: '' },
      partyCode: { type: String, trim: true, default: '' },
      partyName: { type: String, trim: true, default: '' },
      salesman: { type: String, trim: true, default: '' },
      vocNo: { type: String, trim: true, default: '' },
      refNo: { type: String, trim: true, default: '' },
      refDate: { type: Date, default: null },
      postedDate: { type: Date, default: null },
      lineItems: [
        {
          branch: { type: String, trim: true, default: '' },
          acCode: { type: String, trim: true, default: '' },
          type: { type: String, trim: true, default: 'Cash' }, // Cash, Cheque, Transfer
          typeCode: { type: String, trim: true, default: '' },
          currCode: { type: String, trim: true, default: 'AED' },
          currRate: { type: Number, default: 1 },
          exp: { type: String, trim: true, default: '' },
          trnNumber: { type: String, trim: true, default: '' },
          trnInv: { type: String, trim: true, default: '' },
          trnInvDate: { type: Date, default: null },
          hsnAc: { type: String, trim: true, default: '' },
          trnRef: { type: String, trim: true, default: '' },
          chqNo: { type: String, trim: true, default: '' },
          chqDate: { type: Date, default: null },
          chqBank: { type: String, trim: true, default: '' },
          amountFC: { type: Number, default: 0 },
          amountLC: { type: Number, default: 0 },
          headerAmt: { type: Number, default: 0 },
          trnPer: { type: Number, default: 0 },
          trnAmountFC: { type: Number, default: 0 },
          trnAmountLC: { type: Number, default: 0 },
          amountWithTRN: { type: Number, default: 0 },
          headerAmountWithTRN: { type: Number, default: 0 },
          narration: { type: String, trim: true, default: '' },
        },
      ],
    },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

transactionSchema.index({ type: 1, date: -1 })

module.exports = mongoose.model('Transaction', transactionSchema)
