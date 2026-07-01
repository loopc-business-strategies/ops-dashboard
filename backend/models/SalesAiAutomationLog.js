const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const salesAiAutomationLogSchema = new mongoose.Schema({
  tenant: { type: String, required: true, lowercase: true, trim: true, index: true },
  actionType: { type: String, required: true, index: true },
  tier: { type: String, enum: ['auto', 'approve'], default: 'auto' },
  status: { type: String, enum: ['completed', 'skipped', 'failed', 'pending'], default: 'completed' },
  title: { type: String, default: '' },
  detail: { type: String, default: '' },
  source: { type: String, default: 'proactive' },
  dedupeKey: { type: String, default: '', index: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

salesAiAutomationLogSchema.index({ tenant: 1, createdAt: -1 })
salesAiAutomationLogSchema.index(
  { tenant: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string', $ne: '' } } },
)

module.exports = createTenantModel('SalesAiAutomationLog', salesAiAutomationLogSchema)
