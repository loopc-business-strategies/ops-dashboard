const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const messageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['group', 'dm'],
      default: 'group',
    },
    room: {
      type: String,
      trim: true,
      default: 'General',
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    recipientIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    recipientNames: {
      type: [String],
      default: [],
    },
    text: {
      type: String,
      trim: true,
      default: '',
    },
    attachments: {
      type: [{
        fileName: { type: String, trim: true, required: true },
        originalName: { type: String, trim: true, default: '' },
        mimeType: { type: String, trim: true, default: 'application/octet-stream' },
        size: { type: Number, default: 0 },
        kind: { type: String, enum: ['file', 'image', 'audio'], default: 'file' },
      }],
      default: [],
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatGroup',
      default: null,
    },
  },
  { timestamps: true }
)

messageSchema.index({ createdAt: -1 })
messageSchema.index({ department: 1, createdAt: -1 })
messageSchema.index({ senderId: 1, createdAt: -1 })
messageSchema.index({ recipientIds: 1, createdAt: -1 })
messageSchema.index({ type: 1, groupId: 1, createdAt: -1 })
messageSchema.index({ groupId: 1, createdAt: -1 })

module.exports = createTenantModel('Message', messageSchema)
