const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { QC_RESULTS } = require('../services/productionControl/constants')

const qcInspectionSchema = new mongoose.Schema(
  {
    inspectionNumber: { type: String, required: true, trim: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', required: true },
    batchNumber: { type: String, trim: true, default: '' },
    process: { type: String, trim: true, default: '' },
    processRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcessRun', default: null },
    inspectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    inspectorName: { type: String, trim: true, default: '' },
    weight: { type: Number, default: null },
    purity: { type: String, trim: true, default: '' },
    dimensions: { type: String, trim: true, default: '' },
    finish: { type: String, trim: true, default: '' },
    stamp: { type: String, trim: true, default: '' },
    visualQuality: { type: String, trim: true, default: '' },
    sop: { type: Boolean, default: null },
    result: { type: String, enum: QC_RESULTS, required: true },
    remarks: { type: String, trim: true, default: '' },
    reworkReason: { type: String, trim: true, default: '' },
    authorizedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    authorizedByName: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, trim: true, default: null },
  },
  { timestamps: true },
)

qcInspectionSchema.index({ inspectionNumber: 1 }, { unique: true })
qcInspectionSchema.index({ batchId: 1, createdAt: -1 })
qcInspectionSchema.index({ result: 1, createdAt: -1 })
qcInspectionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

module.exports = createTenantModel('QcInspection', qcInspectionSchema)
