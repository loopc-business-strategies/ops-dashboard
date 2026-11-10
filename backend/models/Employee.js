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
    /** Uppercase ID with spaces/dashes stripped — used for duplicate detection */
    idNumberNormalized: {
      type: String,
      trim: true,
      default: '',
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
    /** Digits-only phone — used for duplicate detection (empty skipped) */
    phoneNormalized: {
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

    // Spreadsheet-style HR list fields
    salaryAgreed: { type: Number, default: null },
    lastIncrement: { type: Date, default: null },
    rebate: { type: Number, default: null },
    /** YYYY-MM keys when rebate was marked collected for that payroll month */
    rebateCollectedMonths: { type: [String], default: [] },
    /** Per-month actual rebate collections (amount + date); kept in sync with rebateCollectedMonths */
    rebateCollections: {
      type: [{
        month: { type: String, trim: true, required: true },
        amount: { type: Number, min: 0, required: true },
        collectedAt: { type: Date, default: null },
        _id: false,
      }],
      default: [],
    },
    remarks: { type: String, trim: true, default: '' },

    // Soft-delete fields (set by softDeleteById)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedByName: { type: String, trim: true, default: '' },
    deletionReason: { type: String, trim: true, default: '' },
  },
  {
    timestamps: true,
  }
)

employeeSchema.index({ department: 1 })
// Mongo partial unique indexes require equality on isDeleted (not $ne).
// Active rows must have isDeleted: false (schema default on create).
employeeSchema.index(
  { idNumberNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, idNumberNormalized: { $gt: '' } },
  },
)
employeeSchema.index(
  { phoneNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, phoneNormalized: { $gt: '' } },
  },
)

const EmployeeModel = createTenantModel('Employee', employeeSchema)

module.exports = EmployeeModel
module.exports.employeeSchema = employeeSchema
module.exports.getTenantEmployeeModel = EmployeeModel.getTenantModel
