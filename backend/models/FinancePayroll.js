const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const schema = new mongoose.Schema(
  {
    emp:    { type: String, trim: true },
    dept:   { type: String, trim: true },
    role:   { type: String, trim: true },
    basic:  { type: Number, default: 0 },
    allow:  { type: Number, default: 0 },
    ded:    { type: Number, default: 0 },
    net:    { type: Number, default: 0 },
    status: { type: String, trim: true, default: 'Pending' },
    payDate:{ type: String, trim: true },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

module.exports = createTenantModel('FinancePayroll', schema)
