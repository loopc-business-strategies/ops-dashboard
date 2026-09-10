const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { BATCH_STATUSES, METAL_TYPES } = require('../services/productionControl/constants')

const productionBatchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, trim: true },
    workOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
    workOrderNumber: { type: String, trim: true, default: '' },
    metalType: { type: String, enum: METAL_TYPES, required: true },
    purity: { type: String, trim: true, default: '' },
    product: { type: String, trim: true, default: '' },
    purpose: { type: String, trim: true, default: '' },
    targetQuantity: { type: Number, default: 0, min: 0 },
    initialWeight: { type: Number, required: true, min: 0 },
    currentWeight: { type: Number, required: true, min: 0 },
    issuedWeight: { type: Number, default: 0, min: 0 },
    receivedWeight: { type: Number, default: 0, min: 0 },
    processInputWeight: { type: Number, default: 0, min: 0 },
    processOutputWeight: { type: Number, default: 0, min: 0 },
    scrapWeight: { type: Number, default: 0, min: 0 },
    lossWeight: { type: Number, default: 0, min: 0 },
    recoveredWeight: { type: Number, default: 0, min: 0 },
    lastVerifiedWeight: { type: Number, default: null },
    currentDepartment: { type: String, trim: true, default: 'vault' },
    currentLocation: { type: String, trim: true, default: 'Vault' },
    currentHolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    currentHolderName: { type: String, trim: true, default: '' },
    currentProcess: { type: String, trim: true, default: '' },
    currentMachineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionMachine', default: null },
    currentMachineName: { type: String, trim: true, default: '' },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
    status: { type: String, enum: BATCH_STATUSES, default: 'CREATED' },
    holdReason: { type: String, trim: true, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    version: { type: Number, default: 0 },
    idempotencyKey: { type: String, trim: true, default: null },
  },
  { timestamps: true },
)

productionBatchSchema.index({ batchNumber: 1 }, { unique: true })
productionBatchSchema.index({ workOrderId: 1, createdAt: -1 })
productionBatchSchema.index({ status: 1, currentDepartment: 1 })
productionBatchSchema.index({ currentHolderId: 1, status: 1 })
productionBatchSchema.index({ metalType: 1, status: 1 })
productionBatchSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

module.exports = createTenantModel('ProductionBatch', productionBatchSchema)
