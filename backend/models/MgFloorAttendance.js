const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

/** One row per employee login on an MG Floor tablet (operators and managers). */
const mgFloorAttendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    employeeCode: { type: String, trim: true, default: '' },
    productionRole: { type: String, trim: true, default: '' },
    floorDepartment: { type: String, trim: true, default: '' },
    loginMethod: { type: String, enum: ['password', 'pin', 'biometric', ''], default: '' },
    deviceLabel: { type: String, trim: true, maxlength: 120, default: '' },
    loginAt: { type: Date, required: true, default: Date.now },
    logoutAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    durationMinutes: { type: Number, default: null, min: 0 },
    closedBy: { type: String, enum: ['', 'user', 'auto'], default: '' },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  },
  { timestamps: true },
)

mgFloorAttendanceSchema.index({ userId: 1, status: 1 })
mgFloorAttendanceSchema.index({ loginAt: -1 })

module.exports = createTenantModel('MgFloorAttendance', mgFloorAttendanceSchema)
