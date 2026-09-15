const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { STOCK_STATUSES } = require('../services/productionControl/constants')

const productionStockStatusEventSchema = new mongoose.Schema(
  {
    stockLotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionStockLot', required: true },
    stockCode: { type: String, trim: true, default: '' },
    fromStatus: { type: String, trim: true, default: '' },
    toStatus: { type: String, enum: STOCK_STATUSES, required: true },
    reason: { type: String, trim: true, default: '' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', default: null },
    batchNumber: { type: String, trim: true, default: '' },
    processRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcessRun', default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

productionStockStatusEventSchema.index({ stockLotId: 1, createdAt: -1 })
productionStockStatusEventSchema.index({ stockCode: 1, createdAt: -1 })
productionStockStatusEventSchema.index({ batchId: 1, createdAt: -1 })
productionStockStatusEventSchema.index({ toStatus: 1, createdAt: -1 })

module.exports = createTenantModel('ProductionStockStatusEvent', productionStockStatusEventSchema)
