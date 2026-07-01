const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const salesAiActionProposalSchema = new mongoose.Schema({
  tenant: { type: String, required: true, lowercase: true, trim: true, index: true },
  actionType: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'dismissed', 'expired'], default: 'pending', index: true },
  title: { type: String, default: '' },
  summary: { type: String, default: '' },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true })

salesAiActionProposalSchema.index({ tenant: 1, status: 1, createdAt: -1 })

module.exports = createTenantModel('SalesAiActionProposal', salesAiActionProposalSchema)
