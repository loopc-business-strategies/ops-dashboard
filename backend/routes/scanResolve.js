const express = require('express')
const Joi = require('joi')
const { protect } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const ProductionBatch = require('../models/ProductionBatch')
const ProductionStockLot = require('../models/ProductionStockLot')
const WorkOrder = require('../models/WorkOrder')
const InventoryItem = require('../models/InventoryItem')
const ProductionMachine = require('../models/ProductionMachine')

const router = express.Router()

/**
 * Resolve a barcode/QR scan payload to a business record.
 * Hardware-ready: edge gateway should POST here after local decode.
 */
router.post(
  '/resolve',
  protect,
  validateBody(Joi.object({
    code: Joi.string().trim().min(1).max(200).required(),
    hint: Joi.string().valid('stock', 'batch', 'work_order', 'product', 'machine', 'package').allow('', null),
  })),
  async (req, res) => {
    try {
      const code = String(req.body.code || '').trim()
      const upper = code.toUpperCase()
      const hint = String(req.body.hint || '').trim()

      const tryMatch = async () => {
        if (!hint || hint === 'batch') {
          const batch = await ProductionBatch.findOne({
            $or: [{ batchNumber: upper }, { batchNumber: code }, { qrCode: code }, { barcode: code }],
          }).lean()
          if (batch) return { type: 'batch', id: String(batch._id), label: batch.batchNumber, record: batch }
        }
        if (!hint || hint === 'stock') {
          const lot = await ProductionStockLot.findOne({
            $or: [{ stockCode: upper }, { barcode: code }, { qrCode: code }],
          }).lean()
          if (lot) return { type: 'stock_lot', id: String(lot._id), label: lot.stockCode, record: lot }
        }
        if (!hint || hint === 'work_order') {
          const wo = await WorkOrder.findOne({
            $or: [{ woNumber: upper }, { woNumber: code }, { qrCode: code }, { barcode: code }],
          }).lean()
          if (wo) return { type: 'work_order', id: String(wo._id), label: wo.woNumber, record: wo }
        }
        if (!hint || hint === 'product' || hint === 'package') {
          const item = await InventoryItem.findOne({
            isDeleted: { $ne: true },
            $or: [{ sku: code }, { barcode: code }, { qrCode: code }, { name: code }],
          }).lean()
          if (item) return { type: 'product', id: String(item._id), label: item.name, record: item }
        }
        if (!hint || hint === 'machine') {
          const machine = await ProductionMachine.findOne({
            $or: [{ machineCode: upper }, { machineCode: code }, { barcode: code }],
          }).lean()
          if (machine) return { type: 'machine', id: String(machine._id), label: machine.machineCode, record: machine }
        }
        return null
      }

      const match = await tryMatch()
      if (!match) {
        return res.status(404).json({ success: false, message: 'No record found for scan code', code })
      }
      return res.json({ success: true, code, ...match })
    } catch (err) {
      console.error('Scan resolve error:', err)
      res.status(500).json({ success: false, message: 'Scan resolve failed' })
    }
  },
)

module.exports = router
