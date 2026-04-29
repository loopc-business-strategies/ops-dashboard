const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [purchaseOrderItemSchema],
      default: [],
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'ordered', 'in_transit', 'received', 'closed'],
      default: 'draft',
    },
    budgetApprovedByFinance: {
      type: Boolean,
      default: false,
    },
    finalApprovedBySuperAdmin: {
      type: Boolean,
      default: false,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
)

purchaseOrderSchema.virtual('totalAmount').get(function totalAmount() {
  return (this.items || []).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
})

module.exports = createTenantModel('PurchaseOrder', purchaseOrderSchema)
