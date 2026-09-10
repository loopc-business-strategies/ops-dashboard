const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { MACHINE_STATUSES } = require('../services/productionControl/constants')

const productionMachineSchema = new mongoose.Schema(
  {
    machineCode: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: '' },
    process: { type: String, trim: true, default: '' },
    status: { type: String, enum: MACHINE_STATUSES, default: 'IDLE' },
    currentBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', default: null },
    currentBatchNumber: { type: String, trim: true, default: '' },
    currentOperatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    currentOperatorName: { type: String, trim: true, default: '' },
    lastMaintenance: { type: Date, default: null },
    nextMaintenance: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

productionMachineSchema.index({ machineCode: 1 }, { unique: true })
productionMachineSchema.index({ department: 1, status: 1 })
productionMachineSchema.index({ status: 1 })

module.exports = createTenantModel('ProductionMachine', productionMachineSchema)
