// ==========================================
// FILE: backend/models/Employee.js
// WHAT THIS DOES:
//   Defines the shape of every employee record stored in MongoDB.
// ==========================================

const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },

    idNumber: {
      type: String,
      required: [true, 'ID number is required'],
      trim: true,
    },

    employeeCode: {
      type: String,
      required: [true, 'Employee code is required'],
      trim: true,
      unique: true,
    },

    address: {
      type: String,
      trim: true,
      default: '',
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },

    department: {
      type: String,
      trim: true,
      default: '',
    },

    // Rating 1–5
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },

    // Additive HR master fields (backward compatible)
    photoUrl: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    emergencyContactName: { type: String, trim: true, default: '' },
    emergencyContactPhone: { type: String, trim: true, default: '' },
    joiningDate: { type: Date, default: null },
    position: { type: String, trim: true, default: '' },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    managerName: { type: String, trim: true, default: '' },
    shift: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'],
      default: 'ACTIVE',
    },
    contractRef: { type: String, trim: true, default: '' },
    salaryRef: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
  }
)

employeeSchema.index({ department: 1 })

const EmployeeModel = createTenantModel('Employee', employeeSchema)

module.exports = EmployeeModel
module.exports.employeeSchema = employeeSchema
module.exports.getTenantEmployeeModel = EmployeeModel.getTenantModel
