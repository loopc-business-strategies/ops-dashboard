const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

/**
 * Money paid ahead of earned salary (separate from salary balance/arrears).
 * Must never be used to represent August unpaid earned salary.
 */
const employeeAdvanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    employeeName: { type: String, trim: true, default: '' },
    employeeCode: { type: String, trim: true, default: '' },
    amount: { type: Number, required: true, min: 0 },
    remainingBalance: { type: Number, default: 0 },
    requestDate: { type: Date, default: Date.now },
    reason: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'RECOVERING', 'CLOSED', 'REJECTED'],
      default: 'DRAFT',
      index: true,
    },
    approvedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    approvedByName: { type: String, trim: true, default: '' },
    approvedAt: { type: Date, default: null },
    paymentDate: { type: Date, default: null },
    recoveryStartYear: { type: Number, default: null },
    recoveryStartMonth: { type: Number, default: null },
    installmentAmount: { type: Number, default: null },
    recoveryMode: {
      type: String,
      enum: ['ONE_TIME', 'INSTALLMENT'],
      default: 'ONE_TIME',
    },
    recoveries: [{
      amount: { type: Number, default: 0 },
      recoveredAt: { type: Date, default: Date.now },
      note: { type: String, trim: true, default: '' },
      byId: { type: mongoose.Schema.Types.ObjectId, default: null },
      byName: { type: String, trim: true, default: '' },
    }],
    createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByName: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

employeeAdvanceSchema.index({ employeeId: 1, status: 1 })

module.exports = createTenantModel('EmployeeAdvance', employeeAdvanceSchema)
module.exports.employeeAdvanceSchema = employeeAdvanceSchema
module.exports.getTenantEmployeeAdvanceModel = module.exports.getTenantModel
