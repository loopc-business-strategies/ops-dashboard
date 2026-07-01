const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const salesAiTenantSettingsSchema = new mongoose.Schema({
  tenant: { type: String, required: true, unique: true, lowercase: true, trim: true },
  autoEnabled: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true })

module.exports = createTenantModel('SalesAiTenantSettings', salesAiTenantSettingsSchema)
