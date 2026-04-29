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
    stage: {
      type: String,
      enum: ['casting', 'polishing', 'finishing', 'packaging', 'completed'],
      default: 'casting',
    },
    assignedTo: String,
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
      enum: ['pending', 'in_progress', 'quality_check', 'completed'],
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
