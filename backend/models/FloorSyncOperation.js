const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const SYNC_STATUSES = ['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT']

const floorSyncOperationSchema = new mongoose.Schema(
  {
    operationId: { type: String, required: true, trim: true },
    operationType: {
      type: String,
      required: true,
      enum: ['metal_in', 'metal_out', 'transfer', 'weight_adjust', 'xrf_test', 'scan', 'other'],
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    syncStatus: { type: String, enum: SYNC_STATUSES, default: 'PENDING' },
    errorMessage: { type: String, trim: true, default: '' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deviceId: { type: String, trim: true, default: '' },
    scaleId: { type: String, trim: true, default: '' },
    clientTimestamp: { type: Date, default: null },
    syncedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

floorSyncOperationSchema.index({ operationId: 1 }, { unique: true })
floorSyncOperationSchema.index({ syncStatus: 1, createdAt: -1 })
floorSyncOperationSchema.index({ employeeId: 1, createdAt: -1 })

module.exports = createTenantModel('FloorSyncOperation', floorSyncOperationSchema)
module.exports.SYNC_STATUSES = SYNC_STATUSES
