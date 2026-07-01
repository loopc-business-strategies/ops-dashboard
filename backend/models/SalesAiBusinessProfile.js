const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const salesAiBusinessProfileSchema = new mongoose.Schema({
  targetRegions: { type: [String], default: [] },
  productFocus: { type: String, default: '' },
  icpDescription: { type: String, default: '' },
  quarterlyGoals: { type: String, default: '' },
  competitors: { type: [String], default: [] },
  riskAppetite: { type: String, enum: ['conservative', 'balanced', 'aggressive', ''], default: '' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedByName: String,
}, { timestamps: true })

module.exports = createTenantModel('SalesAiBusinessProfile', salesAiBusinessProfileSchema)
