const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const tenantEmailConnectionSchema = new mongoose.Schema(
  {
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
    connectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

tenantEmailConnectionSchema.index({ provider: 1 }, { unique: true })

module.exports = createTenantModel('TenantEmailConnection', tenantEmailConnectionSchema)
