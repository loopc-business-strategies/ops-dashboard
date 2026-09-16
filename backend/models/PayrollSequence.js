const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

/** Tenant-scoped counters for payslip numbers (LOPC-PS-YYYY-MM-######). */
const payrollSequenceSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true, required: true, unique: true },
    seq: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
)

module.exports = createTenantModel('PayrollSequence', payrollSequenceSchema)
module.exports.getTenantPayrollSequenceModel = module.exports.getTenantModel
