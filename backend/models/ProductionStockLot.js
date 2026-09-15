const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')
const { STOCK_STATUSES, METAL_TYPES } = require('../services/productionControl/constants')

const productionStockLotSchema = new mongoose.Schema(
  {
    stockCode: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true, default: '' },
    qrCode: { type: String, trim: true, default: '' },
    purchaseRef: { type: String, trim: true, default: '' },
    supplier: { type: String, trim: true, default: '' },
    purchaseDate: { type: Date, default: null },
    product: { type: String, trim: true, default: '' },
    productCode: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    designNumber: { type: String, trim: true, default: '' },
    quantity: { type: Number, default: 0, min: 0 },
    allocatedQuantity: { type: Number, default: 0, min: 0 },
    grossWeight: { type: Number, default: 0, min: 0 },
    netWeight: { type: Number, default: 0, min: 0 },
    allocatedWeight: { type: Number, default: 0, min: 0 },
    metalType: { type: String, enum: METAL_TYPES, default: 'Gold' },
    purity: { type: String, trim: true, default: '' },
    size: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    receivedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedByName: { type: String, trim: true, default: '' },
    status: { type: String, enum: STOCK_STATUSES, default: 'NEW_STOCK' },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch', default: null },
    batchNumber: { type: String, trim: true, default: '' },
    /** Genealogy: remainder lots created on partial stock selection */
    parentLotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionStockLot', default: null },
    childLotIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductionStockLot' }], default: [] },
    attachmentRefs: {
      type: [
        {
          name: { type: String, trim: true, default: '' },
          url: { type: String, trim: true, default: '' },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    version: { type: Number, default: 0 },
    idempotencyKey: { type: String, trim: true },
  },
  { timestamps: true },
)

productionStockLotSchema.index({ stockCode: 1 }, { unique: true })
productionStockLotSchema.index({ status: 1, updatedAt: -1 })
productionStockLotSchema.index({ product: 1, status: 1 })
productionStockLotSchema.index({ productCode: 1 })
productionStockLotSchema.index({ batchId: 1 })
productionStockLotSchema.index({ parentLotId: 1 })
productionStockLotSchema.index({ inventoryItemId: 1 })
productionStockLotSchema.index({ supplier: 1, purchaseDate: -1 })
productionStockLotSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })

module.exports = createTenantModel('ProductionStockLot', productionStockLotSchema)
