const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

/**
 * MG Floor gateway metadata registry.
 * Secrets stay in MG_GATEWAY_SECRETS env — never stored or returned here.
 */
const floorGatewaySchema = new mongoose.Schema(
  {
    gatewayId: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
)

floorGatewaySchema.index({ gatewayId: 1 }, { unique: true })
floorGatewaySchema.index({ enabled: 1 })

module.exports = createTenantModel('FloorGateway', floorGatewaySchema)
