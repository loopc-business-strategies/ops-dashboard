const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const emailConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['gmail', 'outlook'],
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    scopes: {
      type: [String],
      default: [],
    },
    accessTokenEnc: {
      type: String,
      required: true,
      select: false,
    },
    refreshTokenEnc: {
      type: String,
      default: '',
      select: false,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

emailConnectionSchema.index({ userId: 1, provider: 1 }, { unique: true })

module.exports = createTenantModel('EmailConnection', emailConnectionSchema)
