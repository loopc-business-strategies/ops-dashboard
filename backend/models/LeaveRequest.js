const mongoose = require('mongoose')

const leaveRequestSchema = new mongoose.Schema(
  {
    requesterUserId: {
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
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    days: {
      type: Number,
      min: 1,
      required: [true, 'Days is required'],
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    leaveType: {
      type: String,
      enum: ['medical', 'personal', 'annual', 'sick', 'other'],
      default: 'personal',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedByName: {
      type: String,
      trim: true,
      default: '',
    },
    reviewNote: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

leaveRequestSchema.index({ status: 1, department: 1, createdAt: -1 })

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema)
