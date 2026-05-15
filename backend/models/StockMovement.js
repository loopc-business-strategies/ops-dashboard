const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const stockMovementSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    change: {
      type: Number,
      required: true,
    },
    quantityBefore: {
      type: Number,
      required: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deleteReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
)

module.exports = createTenantModel('StockMovement', stockMovementSchema)
