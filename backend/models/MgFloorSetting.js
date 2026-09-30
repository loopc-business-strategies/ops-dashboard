const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

/** Per-department MG Floor settings set by Floor / Production Managers on the tablet. */
const mgFloorSettingSchema = new mongoose.Schema(
  {
    department: { type: String, required: true, trim: true },
    /** Metal loss above this % of Metal In shows red on the tablet; null = no limit. */
    lossLimitPct: { type: Number, default: null, min: 0 },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

mgFloorSettingSchema.index({ department: 1 }, { unique: true })

module.exports = createTenantModel('MgFloorSetting', mgFloorSettingSchema)
