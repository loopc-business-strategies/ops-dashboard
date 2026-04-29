const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const inventoryItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['raw_material', 'finished_good', 'wip'],
      default: 'raw_material',
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'units',
    },
    minThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    unitCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    supplierName: {
      type: String,
      trim: true,
      default: '',
    },
    weight: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    wipStage: {
      type: String,
      trim: true,
      default: '',
    },
    lastRestockedAt: {
      type: Date,
      default: null,
    },
    ledgerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChartOfAccount',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

module.exports = createTenantModel('InventoryItem', inventoryItemSchema)
