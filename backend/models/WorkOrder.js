const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const WorkOrderSchema = new mongoose.Schema(
  {
    woNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    product: { type: String, trim: true, default: '' },
    unit: { type: String, trim: true, default: 'pcs' },
    line: { type: String, trim: true, default: '' },
    startDate: { type: Date, default: null },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    stage: {
      type: String,
      enum: ['casting', 'polishing', 'finishing', 'packaging', 'completed'],
      default: 'casting',
    },
    assignedTo: { type: String, default: '' },
    materialNeeded: [
      {
        itemId: mongoose.Schema.Types.ObjectId,
        itemName: String,
        quantityNeeded: Number,
      },
    ],
    targetDate: Date,
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'in-progress', 'in_progress', 'quality_check', 'completed', 'on_hold', 'cancelled'],
      default: 'pending',
    },
    qcPassed: {
      type: Boolean,
      default: null,
    },
    qcNotes: String,
    createdById: mongoose.Schema.Types.ObjectId,
    createdByName: String,
  },
  { timestamps: true }
)

module.exports = createTenantModel('WorkOrder', WorkOrderSchema)
