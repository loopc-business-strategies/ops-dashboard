const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

/**
 * Append-only dated HR remarks for an employee (separate from create-time employee fields).
 */
const employeeRemarkSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      trim: true,
      default: '',
    },
    text: {
      type: String,
      required: [true, 'Remark text is required'],
      trim: true,
      maxlength: 2000,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
)

employeeRemarkSchema.index({ employeeId: 1, createdAt: -1 })

module.exports = createTenantModel('EmployeeRemark', employeeRemarkSchema)
