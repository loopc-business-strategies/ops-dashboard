const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const productionFloorSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    name: { type: String, required: true, trim: true },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionShiftConfig', default: null },
    shiftName: { type: String, trim: true, default: '' },
    loginAt: { type: Date, required: true, default: Date.now },
    logoutAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    durationMinutes: { type: Number, default: null, min: 0 },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
  },
  { timestamps: true },
)

productionFloorSessionSchema.index({ userId: 1, status: 1 })
productionFloorSessionSchema.index({ status: 1, loginAt: -1 })
productionFloorSessionSchema.index({ shiftId: 1, loginAt: -1 })
productionFloorSessionSchema.index({ loginAt: -1 })

module.exports = createTenantModel('ProductionFloorSession', productionFloorSessionSchema)
