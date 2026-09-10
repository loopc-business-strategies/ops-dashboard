const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { PROCESS_STATUSES } = require('../services/productionControl/constants')

const processRunSchema = new mongoose.Schema(
  {
    processNumber: { type: String, required: true, trim: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', required: true },
    batchNumber: { type: String, trim: true, default: '' },
    process: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: '' },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionMachine', default: null },
    machineName: { type: String, trim: true, default: '' },
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    operatorName: { type: String, trim: true, default: '' },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    inputWeight: { type: Number, default: 0, min: 0 },
    outputWeight: { type: Number, default: null, min: 0 },
    scrap: { type: Number, default: 0, min: 0 },
    loss: { type: Number, default: 0, min: 0 },
    sopFollowed: { type: Boolean, default: null },
    remarks: { type: String, trim: true, default: '' },
    status: { type: String, enum: PROCESS_STATUSES, default: 'PENDING' },
    // Process-specific optional capture (additive Mixed — never overwrites history)
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    completeIdempotencyKey: { type: String, trim: true, default: null },
  },
  { timestamps: true },
)

processRunSchema.index({ processNumber: 1 }, { unique: true })
processRunSchema.index({ batchId: 1, createdAt: -1 })
processRunSchema.index({ status: 1, process: 1 })
processRunSchema.index({ completeIdempotencyKey: 1 }, { unique: true, sparse: true })

module.exports = createTenantModel('ProcessRun', processRunSchema)
