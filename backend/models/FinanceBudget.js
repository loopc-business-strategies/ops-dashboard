const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const schema = new mongoose.Schema(
  {
    dept:   { type: String, trim: true },
    annual: { type: Number, default: 0 },
    spent:  { type: Number, default: 0 },
    status: { type: String, trim: true, default: 'On Track' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

module.exports = createTenantModel('FinanceBudget', schema)
