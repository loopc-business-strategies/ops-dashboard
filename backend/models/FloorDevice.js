const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const floorDeviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, trim: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, trim: true, default: '' },
    appVersion: { type: String, trim: true, default: '' },
    os: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    status: { type: String, trim: true, default: 'active' },
    lastSeenAt: { type: Date, default: Date.now },
    pushToken: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

floorDeviceSchema.index({ deviceId: 1 }, { unique: true })
floorDeviceSchema.index({ employeeId: 1 })
floorDeviceSchema.index({ lastSeenAt: -1 })

module.exports = createTenantModel('FloorDevice', floorDeviceSchema)
