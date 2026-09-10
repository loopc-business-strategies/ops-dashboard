const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { DEFAULT_FLOW_STAGES, DEFAULT_WEIGHT_TOLERANCE_PCT } = require('../services/productionControl/constants')

const productionFlowConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, default: 'default' },
    name: { type: String, trim: true, default: 'Default Production Flow' },
    stages: {
      type: [
        {
          key: { type: String, required: true, trim: true },
          label: { type: String, required: true, trim: true },
          process: { type: String, trim: true, default: null },
          order: { type: Number, required: true },
        },
      ],
      default: () => DEFAULT_FLOW_STAGES.map((s) => ({ ...s })),
    },
    weightTolerancePct: { type: Number, default: DEFAULT_WEIGHT_TOLERANCE_PCT, min: 0 },
    autoHoldOnVariance: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

productionFlowConfigSchema.index({ key: 1 }, { unique: true })

module.exports = createTenantModel('ProductionFlowConfig', productionFlowConfigSchema)
