const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { PASS_STATUSES, METAL_TYPES } = require('../services/productionControl/constants')

const productionPassSchema = new mongoose.Schema(
  {
    passNumber: { type: String, required: true, trim: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', required: true },
    batchNumber: { type: String, trim: true, default: '' },
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
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionMachine', default: null },
    machineName: { type: String, trim: true, default: '' },
    status: { type: String, enum: PASS_STATUSES, default: 'REQUESTED' },
    issuedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    issuedByName: { type: String, trim: true, default: '' },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedByName: { type: String, trim: true, default: '' },
    receivedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedByName: { type: String, trim: true, default: '' },
    issuedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    receivedWeight: { type: Number, default: null },
    movementId: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalMovement', default: null },
    idempotencyKey: { type: String, trim: true, default: null },
    receiveIdempotencyKey: { type: String, trim: true, default: null },
  },
  { timestamps: true },
)

productionPassSchema.index({ passNumber: 1 }, { unique: true })
productionPassSchema.index({ batchId: 1, createdAt: -1 })
productionPassSchema.index({ status: 1, toDepartment: 1 })
productionPassSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })
productionPassSchema.index({ receiveIdempotencyKey: 1 }, { unique: true, sparse: true })

module.exports = createTenantModel('ProductionPass', productionPassSchema)
