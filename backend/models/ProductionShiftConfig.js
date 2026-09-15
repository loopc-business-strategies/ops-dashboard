const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const productionShiftConfigSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true, trim: true, default: '09:00' },
    endTime: { type: String, required: true, trim: true, default: '21:00' },
    breakMinutes: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    workingDays: {
      type: [
        {
          type: String,
          enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        },
      ],
      default: () => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

productionShiftConfigSchema.index({ name: 1 }, { unique: true })
productionShiftConfigSchema.index({ isActive: 1, sortOrder: 1 })

module.exports = createTenantModel('ProductionShiftConfig', productionShiftConfigSchema)
