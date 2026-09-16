const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const componentSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, required: true },
    label: { type: String, trim: true, default: '' },
    amount: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
)

const employeeSalaryAssignmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    earnings: { type: [componentSchema], default: [] },
    deductions: { type: [componentSchema], default: [] },
    employerContributions: { type: [componentSchema], default: [] },
    effectiveFrom: { type: Date, default: Date.now },
    version: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, default: null },
    createdByName: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

employeeSalaryAssignmentSchema.index(
  { employeeId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true, isDeleted: { $ne: true } } }
)

module.exports = createTenantModel('EmployeeSalaryAssignment', employeeSalaryAssignmentSchema)
module.exports.employeeSalaryAssignmentSchema = employeeSalaryAssignmentSchema
module.exports.getTenantEmployeeSalaryAssignmentModel = module.exports.getTenantModel
