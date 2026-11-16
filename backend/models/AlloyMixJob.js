const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { PRODUCTION_DEPARTMENT_KEYS } = require('../constants/productionDepartments')

const ALLOY_MIX_JOB_STATUSES = ['in_vault', 'in_department', 'closed']

const historyEntrySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    action: {
      type: String,
      enum: ['post', 'update', 'allocate', 'return_vault', 'close'],
      required: true,
    },
    fromDepartment: { type: String, trim: true, default: '' },
    toDepartment: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

const alloyMixJobSchema = new mongoose.Schema(
  {
    mixCode: { type: String, required: true, trim: true, uppercase: true },
    reasonBase: { type: String, required: true, trim: true },
    karat: { type: Number, required: true, min: 1, max: 24 },
    targetGross: { type: Number, required: true, min: 0 },
    metalLossGross: { type: Number, default: 0, min: 0 },
    finishedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    finishedProductName: { type: String, trim: true, default: '' },
    purity: { type: Number, default: null },
    stockLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductionStockLot',
      default: null,
    },
    stockCode: { type: String, trim: true, default: '' },
    /** When this job was split from a partial Allocate. */
    parentJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AlloyMixJob',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ALLOY_MIX_JOB_STATUSES,
      default: 'in_vault',
      index: true,
    },
    currentDepartment: {
      type: String,
      enum: PRODUCTION_DEPARTMENT_KEYS,
      default: 'vault_room',
      index: true,
    },
    history: { type: [historyEntrySchema], default: [] },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, trim: true, default: '' },
    closedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deleteReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
)

alloyMixJobSchema.index({ mixCode: 1 }, { unique: true })
alloyMixJobSchema.index({ reasonBase: 1, isDeleted: 1 })
alloyMixJobSchema.index({ status: 1, currentDepartment: 1, isDeleted: 1 })
alloyMixJobSchema.index({ finishedProductId: 1, isDeleted: 1 })

module.exports = createTenantModel('AlloyMixJob', alloyMixJobSchema)
module.exports.ALLOY_MIX_JOB_STATUSES = ALLOY_MIX_JOB_STATUSES
