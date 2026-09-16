const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const componentSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' },
    label: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
)

const payslipSchema = new mongoose.Schema(
  {
    number: { type: String, trim: true, required: true },
    payrollRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollRun',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    employeeName: { type: String, trim: true, default: '' },
    employeeCode: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    position: { type: String, trim: true, default: '' },
    earnings: { type: [componentSnapshotSchema], default: [] },
    deductions: { type: [componentSnapshotSchema], default: [] },
    employerContributions: { type: [componentSnapshotSchema], default: [] },
    gross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    employerTotal: { type: Number, default: 0 },
    paymentDate: { type: Date, default: null },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'REISSUED', 'VOID'],
      default: 'PENDING',
    },
    bankMasked: { type: String, trim: true, default: '' },
    supersedesPayslipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payslip', default: null },
    isReissue: { type: Boolean, default: false },
    generatedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    generatedByName: { type: String, trim: true, default: '' },
    generatedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

payslipSchema.index({ number: 1 }, { unique: true })
payslipSchema.index(
  { payrollRunId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: { $ne: true },
      isReissue: { $ne: true },
      paymentStatus: { $nin: ['REISSUED', 'VOID'] },
    },
  }
)
payslipSchema.index({ year: 1, month: 1, employeeId: 1 })

module.exports = createTenantModel('Payslip', payslipSchema)
module.exports.payslipSchema = payslipSchema
module.exports.getTenantPayslipModel = module.exports.getTenantModel
