const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { PRODUCTION_DEPARTMENT_KEYS: DEPARTMENT_KEYS } = require('../constants/productionDepartments')

const operationsProductionEntrySchema = new mongoose.Schema(
  {
    departmentKey: {
      type: String,
      required: true,
      trim: true,
      enum: DEPARTMENT_KEYS,
      index: true,
    },
    batchNumber: { type: String, trim: true, default: '' },
    metalIn: { type: Number, default: null, min: 0 },
    metalOut: { type: Number, default: null, min: 0 },
    metalLoss: { type: Number, default: null, min: 0 },
    /** Purity % of Metal IN (0–100). */
    purity: { type: Number, default: null, min: 0, max: 100 },
    /** Fine gold grams in Metal IN (metalIn × purity / 100). */
    fineGold: { type: Number, default: null, min: 0 },
    employeeName: { type: String, trim: true, default: '' },
    departmentManagerName: { type: String, trim: true, default: '' },
    batchStartedAt: { type: Date, default: null },
    batchOverAt: { type: Date, default: null },
    rating: { type: String, trim: true, default: '' },
    breakdown: { type: String, trim: true, default: '' },
    requests: { type: String, trim: true, default: '' },
    /** Day key YYYY-MM-DD */
    date: { type: String, required: true, trim: true, index: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    /** 'mg_floor' rows are written by Floor Manager approvals; their metal fields are read-only. */
    source: { type: String, enum: ['manual', 'mg_floor'], default: 'manual' },
    /** entryDate|department|batchLabel of the MG Floor batch (mg_floor rows only). */
    floorBatchKey: { type: String, trim: true },
    floorInEntryId: { type: String, trim: true, default: '' },
    floorOutEntryId: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

operationsProductionEntrySchema.index({ departmentKey: 1, date: -1 })
operationsProductionEntrySchema.index({ date: 1, createdAt: -1 })
operationsProductionEntrySchema.index({ floorBatchKey: 1 }, { unique: true, sparse: true })

operationsProductionEntrySchema.statics.DEPARTMENT_KEYS = DEPARTMENT_KEYS

const OperationsProductionEntry = createTenantModel('OperationsProductionEntry', operationsProductionEntrySchema)
OperationsProductionEntry.DEPARTMENT_KEYS = DEPARTMENT_KEYS

module.exports = OperationsProductionEntry
module.exports.DEPARTMENT_KEYS = DEPARTMENT_KEYS
