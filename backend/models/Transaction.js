const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll', 'metal_receipt', 'metal_payment'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    description: { type: String, trim: true, default: '' },
    currency: { type: String, trim: true, default: 'USD' },
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
        mentionedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        readBy: [
          {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            readAt: { type: Date, default: Date.now },
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    attachments: [
      {
        originalName: { type: String, trim: true, required: true },
        fileName: { type: String, trim: true, required: true },
        relativePath: { type: String, trim: true, required: true },
        url: { type: String, trim: true, required: true },
        storageDriver: { type: String, enum: ['local', 'gridfs'], default: 'local' },
        storageKey: { type: String, trim: true, default: '' },
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
      partyAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
      vocNo: { type: String, trim: true, default: '' },
      refNo: { type: String, trim: true, default: '' },
      fixingType: { type: String, enum: ['fixing', 'non-fixing', 'non_fixing'], default: 'fixing' },
      metalRate: { type: Number, default: 0 },
      docDate: { type: Date, default: null },
      valueDate: { type: Date, default: null },
      refDate: { type: Date, default: null },
      postedDate: { type: Date, default: null },
      referenceExchangeRate: { type: Number, default: 0 },
      invoiceExchangeRate: { type: Number, default: 0 },
      currRateSource: { type: String, trim: true, default: 'currency_table' },
      rateMeta: { type: mongoose.Schema.Types.Mixed, default: null },
      lineItems: [
        {
          branch: { type: String, trim: true, default: '' },
          inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
          acCode: { type: String, trim: true, default: '' },
          stockCode: { type: String, trim: true, default: '' },
          productType: { type: String, trim: true, default: '' },
          type: { type: String, trim: true, default: 'Cash' }, // Cash, Cheque, Transfer
          typeCode: { type: String, trim: true, default: '' },
          currCode: { type: String, trim: true, default: 'USD' },
          currRate: { type: Number, default: 1 },
          referenceRate: { type: Number, default: 0 },
          pcs: { type: Number, default: 0 },
          grossWeight: { type: Number, default: 0 },
          purity: { type: Number, default: 0 },
          pureWeight: { type: Number, default: 0 },
          metalAmount: { type: Number, default: 0 },
          metalRate: { type: Number, default: 0 },
          rateType: { type: String, trim: true, default: 'OZ' },
          premiumValue: { type: Number, default: 0 },
          premiumAmount: { type: Number, default: 0 },
          makingCharges: { type: Number, default: 0 },
          totalAmount: { type: Number, default: 0 },
          exp: { type: String, trim: true, default: '' },
          vatNumber: { type: String, trim: true, default: '' },
          vatInv: { type: String, trim: true, default: '' },
          vatInvDate: { type: Date, default: null },
          hsnAc: { type: String, trim: true, default: '' },
          vatRef: { type: String, trim: true, default: '' },
          chqNo: { type: String, trim: true, default: '' },
          chqDate: { type: Date, default: null },
          chqBank: { type: String, trim: true, default: '' },
          amountFC: { type: Number, default: 0 },
          amountLC: { type: Number, default: 0 },
          headerAmt: { type: Number, default: 0 },
          vatPer: { type: Number, default: 0 },
          vatAmountFC: { type: Number, default: 0 },
          vatAmountLC: { type: Number, default: 0 },
          amountWithVAT: { type: Number, default: 0 },
          headerAmountWithVAT: { type: Number, default: 0 },
          narration: { type: String, trim: true, default: '' },
          currRateSource: { type: String, trim: true, default: 'manual' },
        },
      ],
    },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

// Query performance indexes
transactionSchema.index({ type: 1, date: -1 })
transactionSchema.index({ date: -1 })
transactionSchema.index({ status: 1, date: -1 })
transactionSchema.index({ customerId: 1, date: -1 })
transactionSchema.index({ vendorId: 1, date: -1 })
transactionSchema.index({ 'voucherMeta.vocNo': 1 })
transactionSchema.index({ createdBy: 1, date: -1 })
transactionSchema.index({ isDeleted: 1, date: -1 })
transactionSchema.index({ journalEntryId: 1 })
transactionSchema.index({ customerId: 1, type: 1, status: 1, isDeleted: 1 })
transactionSchema.index({ vendorId: 1, type: 1, status: 1, isDeleted: 1 })
transactionSchema.index({ isDeleted: 1, type: 1, status: 1, date: 1 })

// No USD-lock hook — preserve transaction and line-item currencies/rates.

module.exports = createTenantModel('Transaction', transactionSchema)
