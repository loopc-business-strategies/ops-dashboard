const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const schema = new mongoose.Schema(
  {
    taxType: { type: String, trim: true },
    period:  { type: String, trim: true },
    amount:  { type: Number, default: 0 },
    dueDate: { type: String, trim: true },
    filedDate:{ type: String, trim: true, default: '—' },
    status:  { type: String, trim: true, default: 'Due Soon' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

module.exports = createTenantModel('FinanceTax', schema)
