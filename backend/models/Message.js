const mongoose = require('mongoose')

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
      required: [true, 'Message text is required'],
      trim: true,
    },
  },
  { timestamps: true }
)

messageSchema.index({ createdAt: -1 })
messageSchema.index({ department: 1, createdAt: -1 })
messageSchema.index({ senderId: 1, createdAt: -1 })
messageSchema.index({ recipientIds: 1, createdAt: -1 })

module.exports = mongoose.model('Message', messageSchema)
