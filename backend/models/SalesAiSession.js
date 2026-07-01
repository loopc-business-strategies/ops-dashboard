const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed },
}, { _id: false })

const salesAiSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  userName: String,
  title: { type: String, default: 'Sales briefing' },
  messages: { type: [messageSchema], default: [] },
  pinned: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true })

salesAiSessionSchema.index({ userId: 1, updatedAt: -1 })

module.exports = createTenantModel('SalesAiSession', salesAiSessionSchema)
