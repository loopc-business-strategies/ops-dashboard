const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: '' },
    paidById: { type: mongoose.Schema.Types.ObjectId, default: null },
    paidByName: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, trim: true, default: '' },
  },
  { _id: true }
)

/** Earned-but-unpaid salary (arrears). Never an employee advance. */
const salaryBalanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    employeeName: { type: String, trim: true, default: '' },
    employeeCode: { type: String, trim: true, default: '' },
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
      index: true,
    },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    earnedAmount: { type: Number, default: 0 },
    amountPaidFromPayroll: { type: Number, default: 0 },
    originalOutstanding: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['OUTSTANDING', 'PARTIALLY_PAID', 'PAID'],
      default: 'OUTSTANDING',
      index: true,
    },
    payments: { type: [paymentSchema], default: [] },
    createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByName: { type: String, trim: true, default: '' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

salaryBalanceSchema.index(
  { payrollRunId: 1, employeeId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
)

module.exports = createTenantModel('SalaryBalance', salaryBalanceSchema)
module.exports.salaryBalanceSchema = salaryBalanceSchema
module.exports.getTenantSalaryBalanceModel = module.exports.getTenantModel
