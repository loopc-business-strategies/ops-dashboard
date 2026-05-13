const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const vendorWorkflowHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['draft', 'review', 'approved', 'blacklisted'], required: true },
    reason: { type: String, trim: true, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const vendorDocumentSchema = new mongoose.Schema(
  {
    docType: {
      type: String,
      enum: ['contract', 'trade_license', 'vat_certificate', 'bank_proof', 'other'],
      default: 'other',
    },
    title: { type: String, trim: true, required: true },
    documentNo: { type: String, trim: true, default: '' },
    fileUrl: { type: String, trim: true, default: '' },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    status: { type: String, enum: ['active', 'expired', 'pending_verification'], default: 'active' },
    verified: { type: Boolean, default: false },
    notes: { type: String, trim: true, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

const vendorSchema = new mongoose.Schema(
  {
    vendorCode: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    gstVat: { type: String, trim: true, default: '' },
    taxRegistrationNo: { type: String, trim: true, default: '' },
    paymentTermsDays: { type: Number, min: 0, default: 30 },
    creditLimit: { type: Number, min: 0, default: 0 },
    category: { type: String, trim: true, default: 'general' },
    rating: { type: Number, min: 1, max: 5, default: 3 },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['active', 'on_hold', 'blacklisted'], default: 'active' },
    approvalStatus: { type: String, enum: ['draft', 'review', 'approved', 'blacklisted'], default: 'draft' },
    approvalHistory: [vendorWorkflowHistorySchema],
    preferredCurrency: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    bankAccountNumber: { type: String, trim: true, default: '' },
    iban: { type: String, trim: true, default: '' },
    swiftCode: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    tags: [{ type: String, trim: true }],
    documents: [vendorDocumentSchema],
    openingBalance: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, default: 'USD' },
    ledgerAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChartOfAccount', default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

vendorSchema.index({ name: 1 })
vendorSchema.index({ vendorCode: 1 })
vendorSchema.index({ email: 1 })
vendorSchema.index({ isActive: 1 })
vendorSchema.index({ status: 1 })
vendorSchema.index({ approvalStatus: 1 })
vendorSchema.index({ category: 1 })
vendorSchema.index({ isActive: 1, name: 1 })

module.exports = createTenantModel('Vendor', vendorSchema)
