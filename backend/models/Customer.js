const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    gstVat: {
      type: String,
      trim: true,
      default: '',
    },
    openingBalance: {
      type: Number,
      min: 0,
      default: 0,
    },
    creditLimit: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentTermsDays: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'AED',
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ledgerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChartOfAccount',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
)

customerSchema.index({ name: 1 })
customerSchema.index({ email: 1 })
customerSchema.index({ isActive: 1 })

module.exports = mongoose.model('Customer', customerSchema)
