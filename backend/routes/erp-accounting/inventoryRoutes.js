const { respondRouteError } = require('../../utils/routeErrorHelpers')
const { requireDestructiveAdminGuard } = require('../../middleware/destructiveAction')
const { Joi, validateBody, validateBodyStrict, validateParams } = require('../../middleware/validate')
const { sanitizeInventoryCategoryPurity } = require('../../utils/catalogProductPurity')
const {
  applyCatalogOnHandQuantities,
  applyCatalogOnHandPcs,
  catalogOnHandFromMovements,
  catalogQuantityFromMovements,
  isCatalogInventoryProduct,
  rebuildStockMovementQuantityChain,
} = require('../../utils/catalogOnHandQuantity')
const { createAlloyMixService } = require('../../services/erpAccounting/alloyMixService')

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
const alloyMixSchema = Joi.object({
  karat: Joi.number().positive().required(),
  targetGross: Joi.number().positive().required(),
  finishedProductId: objectId.required(),
  lines: Joi.array().items(Joi.object({
    itemId: objectId.required(),
    gross: Joi.number().positive().required(),
    role: Joi.string().trim().allow('').max(40).optional(),
    label: Joi.string().trim().allow('').max(80).optional(),
  })).min(1).required(),
  description: Joi.string().trim().allow('').max(1000).optional(),
})
const alloyMixReverseSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).required(),
})

/** Pure candidate pick for stock-in/out ledger currency (before Currency master validate). */
function pickStockMovementCurrencyCandidate({
  requestedCurrency,
  itemCurrency,
  ledgerCurrency,
  baseCurrencyCode,
  fallbackBase = 'USD',
}) {
  const base = String(baseCurrencyCode || fallbackBase || 'USD').trim().toUpperCase() || 'USD'
  return String(
    requestedCurrency
    || itemCurrency
    || ledgerCurrency
    || base
    || fallbackBase
    || 'USD',
  ).trim().toUpperCase() || base
}

function registerInventoryRoutes(deps) {
  const {
    router,
    protect,
    InventoryItem,
    StockMovement,
    Transaction,
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
    assertAccountingPeriodOpen,
    Currency,
    BASE_CURRENCY_CODE,
  } = deps

  const assertPeriod = typeof assertAccountingPeriodOpen === 'function'
    ? assertAccountingPeriodOpen
    : async () => {}

  const resolveStockMovementCurrency = async ({ requestedCurrency, item }) => {
    const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean()
    const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()

    let ledgerCurrency = ''
    if (item?.ledgerAccountId) {
      const ledgerAccount = await ChartOfAccount.findById(item.ledgerAccountId).select('currency').lean()
      ledgerCurrency = String(ledgerAccount?.currency || '').trim().toUpperCase()
    }

    const candidate = pickStockMovementCurrencyCandidate({
      requestedCurrency,
      itemCurrency: item?.currency,
      ledgerCurrency,
      baseCurrencyCode,
      fallbackBase: BASE_CURRENCY_CODE || 'USD',
    })

    const known = await Currency.findOne({ code: candidate, isActive: true }).select('code').lean()
    if (!known && candidate !== baseCurrencyCode) {
      const err = new Error(`Currency ${candidate} is not an active currency master code`)
      err.status = 400
      throw err
    }
    return candidate
  }

  router.get('/inventory/products', protect, async (req, res) => {
    try {
      if (!canReadErpInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { page, limit, skip } = parsePagination(req.query, 25, 500)
      const query = { isDeleted: { $ne: true } }
      const [products, total] = await Promise.all([
        InventoryItem.find(query)
          .populate('ledgerAccountId', 'accountCode accountName')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        InventoryItem.countDocuments(query),
      ])
      await applyCatalogOnHandQuantities({ InventoryItem, StockMovement, products })
      await applyCatalogOnHandPcs({ InventoryItem, Transaction, products })
      res.json({ success: true, products, total, page, limit })
    } catch (err) {
      respondRouteError(res, err, { tag: 'erp-accounting/inventoryRoutes' })
    }
  })

  router.post('/inventory/products', protect, validateBody(inventoryProductCreateSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }

      const { sku, name, category, unit, unitCost, sellingPrice, quantity, currency, minThreshold, supplierName, weight, wipStage } = req.body
      if (!name) return res.status(400).json({ success: false, message: 'Product name is required' })

      const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean()
      const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
      const resolvedCurrency = String(currency || baseCurrencyCode).trim().toUpperCase() || baseCurrencyCode
      const sanitizedCategory = sanitizeInventoryCategoryPurity(category, name)

      const stockParent = await ChartOfAccount.findOne({
        accountType: 'Asset',
        isActive: true,
        $or: [
          { accountName: /^stock in hand$/i },
          { accountCode: '1200' },
        ],
      }).sort({ accountCode: 1 })

      const accountCode = await nextInventoryAccountCode()
      const stockAccount = await ChartOfAccount.create({
        accountName: `${name} Stock`,
        accountCode,
        accountType: 'Asset',
        parentAccountId: stockParent?._id || null,
        currency: resolvedCurrency,
        description: `Auto-created stock account for ${name}`,
        createdBy: req.user._id,
      })

      const product = await InventoryItem.create({
        sku,
        name,
        category: sanitizedCategory,
        unit: unit || 'pcs',
        minThreshold: Number(minThreshold || 0),
        unitCost: Number(unitCost || 0),
        sellingPrice: Number(sellingPrice || 0),
        quantity: isCatalogInventoryProduct(sanitizedCategory) ? 0 : Number(quantity || 0),
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
      const { itemId, quantity, unitCost, vendorId, currency, description = '' } = req.body
      const qty = Number(quantity || 0)
      const cost = Number(unitCost || 0)
      if (!itemId || qty <= 0) return res.status(400).json({ success: false, message: 'Item and positive quantity are required' })

      const item = await InventoryItem.findById(itemId)
      if (!item || item.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

      const resolvedCurrency = await resolveStockMovementCurrency({
        requestedCurrency: currency,
        item,
      })

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
      const stockDate = new Date()
      await assertPeriod({ tenant: req.tenant, date: stockDate })
      const ledgerEntry = await Ledger.create({
        date: stockDate,
        debitAccountId: item.ledgerAccountId,
        creditAccountId: payableAccountId,
        amount,
        description: description || `Stock IN for ${item.name}`,
        referenceType: 'purchase',
        createdBy: req.user._id,
        updatedBy: req.user._id,
        department: req.user.department,
        currency: resolvedCurrency,
      })

      res.json({ success: true, product: item, ledgerEntry })
    } catch (error) {
      respondRouteError(res, error, { tag: 'erp-accounting/inventory/stock-in' })
    }
  })

  router.post('/inventory/stock-out', protect, validateBody(stockOutSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { itemId, quantity, currency, description = '' } = req.body
      const qty = Number(quantity || 0)
      if (!itemId || qty <= 0) return res.status(400).json({ success: false, message: 'Item and positive quantity are required' })

      const item = await InventoryItem.findById(itemId)
      if (!item || item.isDeleted) return res.status(404).json({ success: false, message: 'Product not found' })

      const resolvedCurrency = await resolveStockMovementCurrency({
        requestedCurrency: currency,
        item,
      })

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
      const stockDate = new Date()
      await assertPeriod({ tenant: req.tenant, date: stockDate })
      const ledgerEntry = await Ledger.create({
        date: stockDate,
        debitAccountId: cogsAccount._id,
        creditAccountId: item.ledgerAccountId,
        amount,
        description: description || `Stock OUT for ${item.name}`,
        referenceType: 'cogs',
        createdBy: req.user._id,
        updatedBy: req.user._id,
        department: req.user.department,
        currency: resolvedCurrency,
      })

      res.json({ success: true, product: item, ledgerEntry })
    } catch (error) {
      respondRouteError(res, error, { tag: 'erp-accounting/inventory/stock-out' })
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
      if (category !== undefined || name !== undefined) {
        const nextName = name !== undefined ? name : product.name
        const nextCategory = category !== undefined ? category : product.category
        product.category = sanitizeInventoryCategoryPurity(nextCategory, nextName)
      }
      if (unit !== undefined) product.unit = unit
      if (minThreshold !== undefined) product.minThreshold = Number(minThreshold || 0)
      if (unitCost !== undefined) product.unitCost = Number(unitCost || 0)
      if (sellingPrice !== undefined) product.sellingPrice = Number(sellingPrice || 0)
      if (supplierName !== undefined) product.supplierName = String(supplierName || '').trim()
      if (weight !== undefined) product.weight = Number(weight || 0)
      if (wipStage !== undefined) product.wipStage = String(wipStage || '').trim()
      if (isCatalogInventoryProduct(product.category)) {
        product.quantity = await catalogOnHandFromMovements(StockMovement, product._id)
      }
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

  const alloyMixService = createAlloyMixService({
    InventoryItem,
    StockMovement,
    Ledger,
    assertAccountingPeriodOpen: assertPeriod,
  })

  router.post('/inventory/alloy-mix', protect, validateBody(alloyMixSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const result = await alloyMixService.postAlloyMix({
        user: req.user,
        tenant: req.tenant,
        karat: req.body.karat,
        targetGross: req.body.targetGross,
        finishedProductId: req.body.finishedProductId,
        lines: req.body.lines,
        description: req.body.description,
      })
      res.status(201).json(result)
    } catch (error) {
      respondRouteError(res, error, { tag: 'erp-accounting/inventory/alloy-mix' })
    }
  })

  router.post('/inventory/alloy-mix/reverse', protect, validateBody(alloyMixReverseSchema), async (req, res) => {
    try {
      if (!canWriteInventory(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const result = await alloyMixService.reverseAlloyMix({
        user: req.user,
        tenant: req.tenant,
        reason: req.body.reason,
      })
      res.json(result)
    } catch (error) {
      respondRouteError(res, error, { tag: 'erp-accounting/inventory/alloy-mix/reverse' })
    }
  })

  router.get('/inventory/stock-ledger', protect, async (req, res) => {
    try {
      if (!canReadErpInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { page, limit, skip } = parsePagination(req.query, 50, 200)
      const includeDeleted = String(req.query.includeDeleted || '') === '1'
      const alloyOnly = String(req.query.alloyOnly || '') === '1'
      const filter = {}
      if (!includeDeleted) filter.isDeleted = { $ne: true }
      if (alloyOnly) {
        // Alloy mix consume/receive rows (active + soft-deleted history when includeDeleted=1).
        filter.reason = /Gold alloy mix|alloy mix/i
      }
      const [movements, total] = await Promise.all([
        StockMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        StockMovement.countDocuments(filter),
      ])
      res.json({ success: true, movements, total, page, limit })
    } catch (err) {
      respondRouteError(res, err, { tag: 'erp-accounting/inventoryRoutes' })
    }
  })

  /** Hard-delete soft-deleted alloy mix movements (clears prior Posted history clutter). */
  router.post('/inventory/alloy-mix/clear-history', protect, async (req, res) => {
    try {
      if (!canManageInventorySettings(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const karatNum = Number(req.body?.karat)
      const reason = Number.isFinite(karatNum) && karatNum > 0
        ? new RegExp(`Gold alloy mix\\s*\\(${karatNum}\\s*K|alloy mix\\s*\\(${karatNum}\\s*K`, 'i')
        : /Gold alloy mix|alloy mix/i
      const result = await StockMovement.deleteMany({
        isDeleted: true,
        reason,
      })
      res.json({
        success: true,
        deletedCount: result.deletedCount || 0,
        karat: Number.isFinite(karatNum) && karatNum > 0 ? karatNum : null,
      })
    } catch (err) {
      respondRouteError(res, err, { tag: 'erp-accounting/inventory/alloy-mix/clear-history' })
    }
  })

  /** Rebuild before/after on active movements after soft-deletes (e.g. mix reverse). */
  router.post('/inventory/rebuild-movement-balances', protect, async (req, res) => {
    try {
      if (!canManageInventorySettings(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const products = await InventoryItem.find({ isDeleted: { $ne: true } })
      const items = []
      let movesUpdated = 0
      let qtyFixed = 0
      for (const product of products) {
        if (!isCatalogInventoryProduct(product.category)) continue
        const result = await rebuildStockMovementQuantityChain(StockMovement, product._id)
        const nextQty = catalogQuantityFromMovements(result.quantity)
        const qtyDiff = Math.abs(Number(product.quantity || 0) - nextQty) > 0.0001
        if (result.updated || qtyDiff) {
          if (qtyDiff) {
            product.quantity = nextQty
            product.updatedBy = req.user._id
            await product.save()
            qtyFixed += 1
          }
          movesUpdated += result.updated
          items.push({
            itemId: String(product._id),
            name: product.name,
            quantity: nextQty,
            movesUpdated: result.updated,
            qtyFixed: qtyDiff,
          })
        }
      }
      res.json({ success: true, itemsTouched: items.length, movesUpdated, qtyFixed, items })
    } catch (err) {
      respondRouteError(res, err, { tag: 'erp-accounting/inventory/rebuild-movement-balances' })
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
    } catch (err) {
      respondRouteError(res, err, { tag: 'erp-accounting/inventoryRoutes' })
    }
  })
}

module.exports = {
  registerInventoryRoutes,
  pickStockMovementCurrencyCandidate,
}
