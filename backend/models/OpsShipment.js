const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const shipmentSchema = new mongoose.Schema(
  {
    shipmentId: { type: String, required: true, trim: true, uppercase: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', default: null },
    batchNumber: { type: String, trim: true, default: '' },
    stockLotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionStockLot', default: null },
    weight: { type: Number, default: 0, min: 0 },
    metalType: { type: String, trim: true, default: '' },
    origin: { type: String, trim: true, default: '' },
    destination: { type: String, trim: true, default: '' },
    carrier: { type: String, trim: true, default: '' },
    driver: { type: String, trim: true, default: '' },
    vehicle: { type: String, trim: true, default: '' },
    documents: { type: [String], default: [] },
    insurance: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['DRAFT', 'IN_TRANSIT', 'ARRIVED', 'DELAYED', 'INCIDENT', 'CANCELLED'],
      default: 'DRAFT',
    },
    eta: { type: Date, default: null },
    actualArrival: { type: Date, default: null },
    incident: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

shipmentSchema.index({ shipmentId: 1 }, { unique: true })
shipmentSchema.index({ status: 1, eta: 1 })
shipmentSchema.index({ batchId: 1 })

module.exports = createTenantModel('OpsShipment', shipmentSchema)
