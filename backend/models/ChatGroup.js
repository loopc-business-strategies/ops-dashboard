const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const chatGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    room: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: String, trim: true, default: '', maxlength: 80 },
    description: { type: String, trim: true, default: '', maxlength: 250 },
    memberIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

chatGroupSchema.index({ room: 1 }, { unique: true })
chatGroupSchema.index({ isActive: 1, updatedAt: -1 })

module.exports = createTenantModel('ChatGroup', chatGroupSchema)
