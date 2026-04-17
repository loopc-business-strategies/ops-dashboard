const mongoose = require('mongoose')

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
      min: 0,
    },
    quantityAfter: {
      type: Number,
      required: true,
      min: 0,
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
  },
  { timestamps: true }
)

module.exports = mongoose.model('StockMovement', stockMovementSchema)
