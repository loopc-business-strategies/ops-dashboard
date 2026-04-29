const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const attendanceRecordSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    employeeName: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    date: {
      type: String,
      required: [true, 'Date is required (YYYY-MM-DD)'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'leave', 'late', 'wfh', 'sick'],
      default: 'present',
    },
    checkIn: {
      type: String,
      trim: true,
      default: '',
    },
    checkOut: {
      type: String,
      trim: true,
      default: '',
    },
    shift: {
      type: String,
      trim: true,
      default: 'Shift 1',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    markedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    markedByName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
)

attendanceRecordSchema.index({ date: 1, employeeName: 1 }, { unique: true })
attendanceRecordSchema.index({ date: 1, department: 1 })

module.exports = createTenantModel('AttendanceRecord', attendanceRecordSchema)
