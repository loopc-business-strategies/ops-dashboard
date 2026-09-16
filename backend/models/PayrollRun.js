const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const PAYROLL_STATUSES = [
  'DRAFT',
  'CALCULATED',
  'UNDER_REVIEW',
  'APPROVED',
  'FINALIZED',
  'PAID',
]

const componentSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' },
    label: { type: String, trim: true, default: '' },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
)

const payrollRunLineSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeCode: { type: String, trim: true, default: '' },
    employeeName: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    position: { type: String, trim: true, default: '' },
    salaryAssignmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    salaryAssignmentVersion: { type: Number, default: null },
    earnings: { type: [componentSnapshotSchema], default: [] },
    deductions: { type: [componentSnapshotSchema], default: [] },
    employerContributions: { type: [componentSnapshotSchema], default: [] },
    gross: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    employerTotal: { type: Number, default: 0 },
    // Optional manual attendance inputs (not auto-derived)
    daysWorked: { type: Number, default: null },
    daysAbsent: { type: Number, default: null },
    overtimeHours: { type: Number, default: null },
    attendanceNotes: { type: String, trim: true, default: '' },
  },
  { _id: true }
)

const payrollRunSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, min: 2000, max: 2100 },
    month: { type: Number, required: true, min: 1, max: 12 },
    label: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: PAYROLL_STATUSES,
      default: 'DRAFT',
      index: true,
    },
    lines: { type: [payrollRunLineSchema], default: [] },
    totals: {
      employeeCount: { type: Number, default: 0 },
      gross: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
      employerTotal: { type: Number, default: 0 },
    },
    version: { type: Number, default: 1, min: 1 },
    idempotencyKey: { type: String, trim: true, default: '', index: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByName: { type: String, trim: true, default: '' },
    calculatedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    calculatedByName: { type: String, trim: true, default: '' },
    calculatedAt: { type: Date, default: null },
    submittedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    submittedByName: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: null },
    approvedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    approvedByName: { type: String, trim: true, default: '' },
    approvedAt: { type: Date, default: null },
    finalizedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    finalizedByName: { type: String, trim: true, default: '' },
    finalizedAt: { type: Date, default: null },
    paidById: { type: mongoose.Schema.Types.ObjectId, default: null },
    paidByName: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

payrollRunSchema.index({ year: 1, month: 1 })
payrollRunSchema.index(
  { year: 1, month: 1, isDeleted: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
)

module.exports = createTenantModel('PayrollRun', payrollRunSchema)
module.exports.payrollRunSchema = payrollRunSchema
module.exports.PAYROLL_STATUSES = PAYROLL_STATUSES
module.exports.getTenantPayrollRunModel = module.exports.getTenantModel
