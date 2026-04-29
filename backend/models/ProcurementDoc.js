const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const ProcurementDocSchema = new mongoose.Schema(
  {
    poId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
    },
    docType: {
      type: String,
      enum: ['receipt', 'invoice', 'inspection_report', 'customs_doc', 'other'],
      default: 'receipt',
    },
    fileName: String,
    fileUrl: String,
    fileSize: Number,
    uploadedBy: String,
    uploadedById: mongoose.Schema.Types.ObjectId,
    expiryDate: Date,
    isExpiringSoon: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

module.exports = createTenantModel('ProcurementDoc', ProcurementDocSchema)
