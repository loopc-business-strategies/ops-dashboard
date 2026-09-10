const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { METAL_TYPES } = require('../services/productionControl/constants')

const metalMovementSchema = new mongoose.Schema(
  {
    movementNumber: { type: String, required: true, trim: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', required: true },
    batchNumber: { type: String, trim: true, default: '' },
    passId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionPass', default: null },
    passNumber: { type: String, trim: true, default: '' },
    fromDepartment: { type: String, trim: true, required: true },
    toDepartment: { type: String, trim: true, required: true },
    fromPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fromPersonName: { type: String, trim: true, default: '' },
    toPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    toPersonName: { type: String, trim: true, default: '' },
    metalType: { type: String, enum: METAL_TYPES, required: true },
    purity: { type: String, trim: true, default: '' },
    weight: { type: Number, required: true, min: 0 },
    purpose: { type: String, trim: true, default: '' },
    issuedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    issuedByName: { type: String, trim: true, default: '' },
    receivedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedByName: { type: String, trim: true, default: '' },
    issuedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['ISSUED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'],
      default: 'ISSUED',
    },
  },
  { timestamps: true },
)

metalMovementSchema.index({ movementNumber: 1 }, { unique: true })
metalMovementSchema.index({ batchId: 1, createdAt: -1 })
metalMovementSchema.index({ passId: 1 })

module.exports = createTenantModel('MetalMovement', metalMovementSchema)
