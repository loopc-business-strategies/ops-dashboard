const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const directDealLineSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerCode: { type: String, trim: true, default: '' },
    customerName: { type: String, trim: true, default: '' },
    direction: { type: String, enum: ['buy', 'sell'], required: true },
    metal: { type: String, trim: true, uppercase: true, default: 'XAU' },
    qty: { type: Number, required: true, min: 0 },
    stockCode: { type: String, trim: true, uppercase: true, default: 'OZ' },
    price: { type: Number, required: true, min: 0 },
    eqOz: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: true }
)

const directDealSchema = new mongoose.Schema(
  {
    docNo: { type: String, required: true, trim: true, index: true },
    entryType: { type: String, enum: ['fixing', 'non_fixing'], required: true, default: 'fixing' },
    docDate: { type: Date, required: true },
    valueDate: { type: Date, required: true },
    currency: { type: String, trim: true, uppercase: true, default: 'USD' },
    branch: { type: String, trim: true, default: 'HO' },
    status: { type: String, enum: ['draft', 'confirmed'], default: 'draft' },
    remarks: { type: String, trim: true, default: '' },
    lineItems: { type: [directDealLineSchema], default: [] },
    totalQty: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

directDealSchema.index({ entryType: 1, docDate: -1 })
directDealSchema.index({ status: 1, updatedAt: -1 })

directDealSchema.pre('validate', function enforceUsdCurrency(next) {
  this.currency = 'USD'
  next()
})

module.exports = createTenantModel('DirectDeal', directDealSchema)
