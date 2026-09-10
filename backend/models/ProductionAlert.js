const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { ALERT_SEVERITIES } = require('../services/productionControl/constants')

const productionAlertSchema = new mongoose.Schema(
  {
    alertNumber: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['weight', 'process', 'machine', 'quality', 'security'],
      required: true,
    },
    code: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true, default: '' },
    severity: { type: String, enum: ALERT_SEVERITIES, default: 'warning' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', default: null },
    batchNumber: { type: String, trim: true, default: '' },
    passId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionPass', default: null },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionMachine', default: null },
    status: { type: String, enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'], default: 'OPEN' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    raisedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    raisedByName: { type: String, trim: true, default: '' },
    resolvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedByName: { type: String, trim: true, default: '' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

productionAlertSchema.index({ alertNumber: 1 }, { unique: true })
productionAlertSchema.index({ status: 1, category: 1, createdAt: -1 })
productionAlertSchema.index({ batchId: 1, createdAt: -1 })

module.exports = createTenantModel('ProductionAlert', productionAlertSchema)
