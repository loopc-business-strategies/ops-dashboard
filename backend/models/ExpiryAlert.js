const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const ExpiryAlertSchema = new mongoose.Schema(
  {
    moduleId: {
      type: String,
      enum: ['procurement_doc', 'visa', 'contract', 'certification', 'license', 'other'],
      required: true,
    },
    relatedId: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    expiryDate: {
      type: Date,
      required: true,
    },
    daysUntilExpiry: Number,
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    notifiedAt: Date,
    resolvedAt: Date,
    resolvedBy: String,
    notes: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

module.exports = createTenantModel('ExpiryAlert', ExpiryAlertSchema)
