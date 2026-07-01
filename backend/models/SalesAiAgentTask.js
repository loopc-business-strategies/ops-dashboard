const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { AGENT_TYPES } = require('../services/salesAi/salesAiAgentTypes')

const salesAiAgentTaskSchema = new mongoose.Schema({
  agent: { type: String, enum: AGENT_TYPES, required: true },
  prompt: { type: String, required: true },
  status: { type: String, enum: ['queued', 'running', 'done', 'failed'], default: 'queued' },
  assignedTo: String,
  assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdByName: String,
  result: { type: String, default: '' },
  error: { type: String, default: '' },
  pageContext: { type: mongoose.Schema.Types.Mixed },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true })

salesAiAgentTaskSchema.index({ status: 1, createdAt: -1 })
salesAiAgentTaskSchema.index({ assignedToId: 1, status: 1 })

module.exports = createTenantModel('SalesAiAgentTask', salesAiAgentTaskSchema)
