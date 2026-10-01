const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { BATCH_ENTRY_DIRECTIONS, BATCH_ENTRY_STATUSES } = require('../constants/mgFloorBatchEntry')

const lineSchema = new mongoose.Schema(
  {
    metal: { type: String, trim: true, required: true },
    qty: { type: Number, default: null },
    purity: { type: Number, default: null },
    time: { type: String, trim: true, default: '' },
  },
  { _id: false },
)

/**
 * Metal In / Metal Out batch typed on the MG Floor tablet dashboard, waiting for Floor Manager approval.
 * Approving it fills the matching Operations → Production workbook row; it does not touch
 * production batches, stock or ERP.
 */
const floorBatchEntrySchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, trim: true },
    direction: { type: String, enum: BATCH_ENTRY_DIRECTIONS, required: true },
    department: { type: String, trim: true, default: '' },
    batchLabel: { type: String, trim: true, required: true },
    /** Tablet-local calendar day (YYYY-MM-DD) the batch belongs to. */
    entryDate: { type: String, trim: true, required: true },
    lines: { type: [lineSchema], default: [] },
    /** Tablet UTC offset in minutes (east positive) so line times (HH:MM) become real timestamps. */
    tzOffsetMinutes: { type: Number, default: null },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employeeName: { type: String, trim: true, default: '' },
    deviceId: { type: String, trim: true, default: '' },
    status: { type: String, enum: BATCH_ENTRY_STATUSES, default: 'PENDING' },
    /** Set while PENDING or APPROVED so a batch can only have one live entry per day; removed on reject. */
    activeKey: { type: String, trim: true },
    submittedAt: { type: Date, required: true },
    decidedAt: { type: Date, default: null },
    decidedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedByName: { type: String, trim: true, default: '' },
    rejectReason: { type: String, trim: true, default: '' },
    /** Set when a manager undoes an approval: the batch goes back to the operator as REJECTED. */
    undoneAt: { type: Date, default: null },
    undoReason: { type: String, trim: true, default: '' },
    /** The approval that was undone (decidedBy* then holds the manager who undid it). */
    approvedByName: { type: String, trim: true, default: '' },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

floorBatchEntrySchema.index({ entryId: 1 }, { unique: true })
floorBatchEntrySchema.index({ activeKey: 1 }, { unique: true, sparse: true })
floorBatchEntrySchema.index({ status: 1, submittedAt: -1 })
floorBatchEntrySchema.index({ entryDate: 1, department: 1, direction: 1 })

module.exports = createTenantModel('FloorBatchEntry', floorBatchEntrySchema)
