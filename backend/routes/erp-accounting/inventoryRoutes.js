const { requireDestructiveAdminGuard } = require('../../middleware/destructiveAction')
const { Joi, validateBody, validateBodyStrict, validateParams } = require('../../middleware/validate')

const objectId = Joi.string().hex().length(24)
const idParamSchema = Joi.object({ id: objectId.required() })
const inventoryProductCreateSchema = Joi.object({
  sku: Joi.string().trim().allow('').max(80).optional(),
  name: Joi.string().trim().min(1).max(200).required(),
  category: Joi.string().trim().allow('').max(1200).optional(),
  unit: Joi.string().trim().allow('').max(30).optional(),
  unitCost: Joi.number().min(0).optional(),
  sellingPrice: Joi.number().min(0).optional(),
  quantity: Joi.number().min(0).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  minThreshold: Joi.number().min(0).optional(),
  supplierName: Joi.string().trim().allow('').max(200).optional(),
  weight: Joi.number().min(0).optional(),
  wipStage: Joi.string().trim().allow('').max(120).optional(),
})
const inventoryProductPatchSchema = inventoryProductCreateSchema.fork(['name'], (schema) => schema.optional()).min(1)
const stockInSchema = Joi.object({
  itemId: objectId.required(),
  quantity: Joi.number().positive().required(),
  unitCost: Joi.number().min(0).optional(),
  vendorId: objectId.allow('', null).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  description: Joi.string().trim().allow('').max(1000).optional(),
})
const stockOutSchema = Joi.object({
  itemId: objectId.required(),
  quantity: Joi.number().positive().required(),
  currency: Joi.string().trim().allow('').max(10).optional(),
  description: Joi.string().trim().allow('').max(1000).optional(),
})

function registerInventoryRoutes(deps) {
  const {
    router,
    protect,
    InventoryItem,
    StockMovement,
    Vendor,
    Ledger,
    ChartOfAccount,
    _canAccessInventory,
    canReadErpInventory,
    canWriteInventory,
    canManageInventorySettings,
    parsePagination,
    nextInventoryAccountCode,
    toMoney,
  } = deps

  router.get('/inventory/products', protect, async (req, res) => {
    try {
      if (!canReadErpInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { page, limit, skip } = parsePagination(req.query, 25, 100)
      const query = { isDeleted: { $ne: true } }
      const [products, total] = await Promise.all([
        InventoryItem.find(query)
          .populate('ledgerAccountId', 'accountCode accountName')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit),
        InventoryItem.countDocuments(query),
      ])
      res.json({ success: true, products, total, page, limit })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.post('/inventory/products', protect, validateBody(inventoryProductCreateSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }

      const { sku, name, category, unit, unitCost, sellingPrice, quantity, currency, minThreshold, supplierName, weight, wipStage } = req.body
      if (!name) return res.status(400).json({ success: false, message: 'Product name is required' })

      const accountCode = await nextInventoryAccountCode()
      const stockAccount = await ChartOfAccount.create({
        accountName: `${name} Stock`,
        accountCode,
        accountType: 'Asset',
        currency: currency || 'USD',
        description: `Auto-created stock account for ${name}`,
        createdBy: req.user._id,
      })

      const product = await InventoryItem.create({
        sku,
        name,
        category,
        unit: unit || 'pcs',
        minThreshold: Number(minThreshold || 0),
        unitCost: Number(unitCost || 0),
        sellingPrice: Number(sellingPrice || 0),
        quantity: Number(quantity || 0),
        supplierName: String(supplierName || '').trim(),
        weight: Number(weight || 0),
        wipStage: String(wipStage || '').trim(),
        ledgerAccountId: stockAccount._id,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      })

      res.status(201).json({ success: true, product })
    } catch (error) {
      console.error('[inventory] error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  router.post('/inventory/stock-in', protect, validateBody(stockInSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { itemId, quantity, unitCost, vendorId, currency = 'USD', description = '' } = req.body
      const qty = Number(quantity || 0)
      const cost = Number(unitCost || 0)
      if (!itemId || qty <= 0) return res.status(400).json({ success: false, message: 'Item and positive quantity are required' })

      const item = await InventoryItem.findById(itemId)
      if (!item || item.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

      const before = Number(item.quantity || 0)
      item.quantity = before + qty
      item.unitCost = cost || item.unitCost
      item.updatedBy = req.user._id
      item.lastRestockedAt = new Date()
      await item.save()

      await StockMovement.create({
        itemId: item._id,
        itemName: item.name,
        change: qty,
        quantityBefore: before,
        quantityAfter: item.quantity,
        reason: 'Stock IN (purchase)',
        actorId: req.user._id,
        actorName: req.user.name,
      })

      let payableAccountId = null
      if (vendorId) {
        const vendor = await Vendor.findById(vendorId)
        payableAccountId = vendor?.ledgerAccountId || null
      }
      if (!payableAccountId) {
        const defaultLiability = await ChartOfAccount.findOne({ accountType: 'Liability', isActive: true }).sort({ accountCode: 1 })
        payableAccountId = defaultLiability?._id || null
      }

      if (!item.ledgerAccountId || !payableAccountId) {
        return res.status(400).json({ success: false, message: 'Inventory or vendor payable account missing' })
      }

      const amount = toMoney(qty * (cost || Number(item.unitCost || 0)))
      const ledgerEntry = await Ledger.create({
        date: new Date(),
        debitAccountId: item.ledgerAccountId,
        creditAccountId: payableAccountId,
        amount,
        description: description || `Stock IN for ${item.name}`,
        referenceType: 'purchase',
        createdBy: req.user._id,
        updatedBy: req.user._id,
        department: req.user.department,
        currency,
      })

      res.json({ success: true, product: item, ledgerEntry })
    } catch (error) {
      console.error('[inventory] error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  router.post('/inventory/stock-out', protect, validateBody(stockOutSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { itemId, quantity, currency = 'USD', description = '' } = req.body
      const qty = Number(quantity || 0)
      if (!itemId || qty <= 0) return res.status(400).json({ success: false, message: 'Item and positive quantity are required' })

      const item = await InventoryItem.findById(itemId)
      if (!item || item.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

      const before = Number(item.quantity || 0)
      item.quantity = before - qty
      item.updatedBy = req.user._id
      await item.save()

      await StockMovement.create({
        itemId: item._id,
        itemName: item.name,
        change: -qty,
        quantityBefore: before,
        quantityAfter: item.quantity,
        reason: 'Stock OUT (sale)',
        actorId: req.user._id,
        actorName: req.user.name,
      })

      const cogsAccount = await ChartOfAccount.findOne({ accountType: 'Expense', isActive: true, accountName: /cogs|cost of goods sold/i })
        || await ChartOfAccount.findOne({ accountType: 'Expense', isActive: true }).sort({ accountCode: 1 })
      if (!item.ledgerAccountId || !cogsAccount) {
        return res.status(400).json({ success: false, message: 'Inventory or COGS account missing' })
      }

      const amount = toMoney(qty * Number(item.unitCost || 0))
      const ledgerEntry = await Ledger.create({
        date: new Date(),
        debitAccountId: cogsAccount._id,
        creditAccountId: item.ledgerAccountId,
        amount,
        description: description || `Stock OUT for ${item.name}`,
        referenceType: 'cogs',
        createdBy: req.user._id,
        updatedBy: req.user._id,
        department: req.user.department,
        currency,
      })

      res.json({ success: true, product: item, ledgerEntry })
    } catch (error) {
      console.error('[inventory] error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  router.put('/inventory/products/:id', protect, validateParams(idParamSchema), validateBodyStrict(inventoryProductPatchSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const product = await InventoryItem.findById(req.params.id)
      if (!product || product.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

      const { sku, name, category, unit, unitCost, sellingPrice, minThreshold, supplierName, weight, wipStage } = req.body
      if (name !== undefined) product.name = name
      if (sku !== undefined) product.sku = sku
      if (category !== undefined) product.category = category
      if (unit !== undefined) product.unit = unit
      if (minThreshold !== undefined) product.minThreshold = Number(minThreshold || 0)
      if (unitCost !== undefined) product.unitCost = Number(unitCost || 0)
      if (sellingPrice !== undefined) product.sellingPrice = Number(sellingPrice || 0)
      if (supplierName !== undefined) product.supplierName = String(supplierName || '').trim()
      if (weight !== undefined) product.weight = Number(weight || 0)
      if (wipStage !== undefined) product.wipStage = String(wipStage || '').trim()
      product.updatedBy = req.user._id
      await product.save()

      res.json({ success: true, product })
    } catch (error) {
      console.error('[inventory] error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  router.delete('/inventory/products/:id', protect, validateParams(idParamSchema), async (req, res) => {
    try {
      if (!canManageInventorySettings(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const product = await InventoryItem.findById(req.params.id)
      if (!product || product.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

      if (Number(product.quantity || 0) > 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete a product with stock on hand. Reduce stock to zero first.' })
      }

      product.isDeleted = true
      product.updatedBy = req.user._id
      await product.save()

      res.json({ success: true, message: 'Product deleted' })
    } catch (error) {
      console.error('[inventory] error:', error)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  })

  router.get('/inventory/stock-ledger', protect, async (req, res) => {
    try {
      if (!canReadErpInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { page, limit, skip } = parsePagination(req.query, 50, 200)
      const [movements, total] = await Promise.all([
        StockMovement.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(limit),
        StockMovement.countDocuments({ isDeleted: { $ne: true } }),
      ])
      res.json({ success: true, movements, total, page, limit })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.delete('/inventory/stock-ledger', protect, requireDestructiveAdminGuard('inventory/stock-ledger'), async (req, res) => {
    try {
      if (!canManageInventorySettings(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const result = await StockMovement.updateMany(
        { isDeleted: { $ne: true } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: req.user._id,
            deleteReason: req.destructiveAction.reason,
          },
        }
      )
      res.json({
        success: true,
        message: 'Stock movement ledger soft-deleted.',
        deletedCount: result.modifiedCount || 0,
        destructiveReason: req.destructiveAction.reason,
      })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })
}

module.exports = {
  registerInventoryRoutes,
}
