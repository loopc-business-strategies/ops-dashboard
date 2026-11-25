const { respondRouteError } = require('../../utils/routeErrorHelpers')
const { requireDestructiveAdminGuard } = require('../../middleware/destructiveAction')
const { Joi, validateBody, validateBodyStrict, validateParams, validateQuery } = require('../../middleware/validate')
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
    /** Remaining grams in finished after oxidation; omit for proportional loss. */
    remainGross: Joi.number().min(0).optional(),
    /**
     * Metal Loss AML grams for this Update only (vs prior remain).
     * Update Mix preserves prior AML so each Update books its own Metal Loss entry.
     * Vault still consumes `gross`; inventory oxidation uses gross − remainGross.
     */
    lossGross: Joi.number().min(0).optional(),
    role: Joi.string().trim().allow('').max(40).optional(),
    label: Joi.string().trim().allow('').max(80).optional(),
  })).min(1).required(),
  description: Joi.string().trim().allow('').max(1000).optional(),
  /** Update/Edit: reuse prior BMG batch instead of minting BMG-0002. */
  reuseMixCode: Joi.string().trim().uppercase().pattern(/^BMG-\d+$/).allow('', null).optional(),
  /** Department that caused this Update metal loss (melting / rolling / update). */
  lossDepartment: Joi.string().trim().allow('').max(40).optional(),
})
const alloyMixReverseSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).required(),
  /** Update Mix: keep prior AML vouchers so 2 Updates → 2 Metal Loss entries. */
  preserveMetalLoss: Joi.boolean().optional(),
})
const alloyMixClearHistorySchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).optional(),
  karat: Joi.number().integer().min(1).max(24).optional(),
}).or('reason', 'karat')
const alloyMixAllocateSchema = Joi.object({
  toDepartment: Joi.string().trim().required(),
  note: Joi.string().trim().allow('').max(500).optional(),
  /** Grams to move; omit for full mix. Less than remaining → split child job. */
  weight: Joi.number().positive().optional(),
})
const alloyMixJobsQuerySchema = Joi.object({
  department: Joi.string().trim().allow('').optional(),
  status: Joi.string().trim().allow('').optional(),
  includeClosed: Joi.boolean().optional(),
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

function emitAlloyMixProductionUpdate(req, event, payload = {}) {
  try {
    const tenant = String(req.tenant || 'mg').trim().toLowerCase() || 'mg'
    const rt = req.app?.get?.('realtimeServer')
    if (rt && typeof rt.broadcastProductionUpdate === 'function') {
      rt.broadcastProductionUpdate(tenant, event, payload)
    }
    const { publishRealtimeEvent } = require('../../utils/realtimeBus')
    publishRealtimeEvent({
      type: 'production:update',
      tenant,
      data: { event, ...payload },
    })
  } catch (err) {
    console.warn('[inventory] alloy-mix realtime emit failed', err?.message || err)
  }
}

function registerInventoryRoutes(deps) {
  const {
    router,
    protect,
    InventoryItem,
    StockMovement,
    Transaction,
    AccountMapping,
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

      const cogsAccount = await ChartOfAccount.findOne({ accountCode: '5101', isActive: true })
        || await ChartOfAccount.findOne({ isActive: true, accountName: /cogs|cost of goods sold/i })
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
    AccountMapping,
    Transaction,
    ChartOfAccount,
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
        reuseMixCode: req.body.reuseMixCode,
        lossDepartment: req.body.lossDepartment,
      })
      emitAlloyMixProductionUpdate(req, 'alloy-mix-post', {
        mixCode: result?.mixJob?.mixCode || null,
        department: result?.mixJob?.currentDepartment || 'vault_room',
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
        preserveMetalLoss: Boolean(req.body.preserveMetalLoss),
      })
      emitAlloyMixProductionUpdate(req, 'alloy-mix-reverse', {
        mixCode: result?.mixJobClosed || null,
      })
      res.json(result)
    } catch (error) {
      respondRouteError(res, error, { tag: 'erp-accounting/inventory/alloy-mix/reverse' })
    }
  })

  router.get('/inventory/alloy-mix/jobs', protect, validateQuery(alloyMixJobsQuerySchema), async (req, res) => {
    try {
      const {
        listMixJobs,
        serializeJobs,
      } = require('../../services/erpAccounting/alloyMixFloorBridge')
      const jobs = await listMixJobs({
        department: req.query.department,
        status: req.query.status,
        includeClosed: req.query.includeClosed === true || req.query.includeClosed === 'true',
      })
      res.json({ success: true, jobs: await serializeJobs(jobs) })
    } catch (error) {
      respondRouteError(res, error, { tag: 'erp-accounting/inventory/alloy-mix/jobs' })
    }
  })

  router.post(
    '/inventory/alloy-mix/jobs/:id/allocate',
    protect,
    validateParams(Joi.object({ id: Joi.string().trim().min(1).max(40).required() })),
    validateBody(alloyMixAllocateSchema),
    async (req, res) => {
      try {
        if (!canWriteInventory(req.user)) {
          return res.status(403).json({ success: false, message: 'Forbidden' })
        }
        const {
          allocateMixJob,
          serializeAllocateResult,
        } = require('../../services/erpAccounting/alloyMixFloorBridge')
        const { runInTransaction } = require('../../utils/mongoTransaction')
        const result = await runInTransaction(async (session) => allocateMixJob({
          user: req.user,
          mixId: req.params.id,
          toDepartment: req.body.toDepartment,
          note: req.body.note,
          weight: req.body.weight,
          session,
        }))
        const payload = await serializeAllocateResult(result)
        emitAlloyMixProductionUpdate(req, 'alloy-mix-allocate', {
          mixCode: payload.job?.mixCode || null,
          department: payload.job?.currentDepartment || null,
          partial: payload.partial,
        })
        res.json({ success: true, ...payload })
      } catch (error) {
        respondRouteError(res, error, { tag: 'erp-accounting/inventory/alloy-mix/jobs/allocate' })
      }
    },
  )

  const alloyMixAddMetalSchema = Joi.object({
    productId: Joi.string().trim().min(1).max(40).required(),
    gross: Joi.number().positive().required(),
    purity: Joi.number().min(0).max(100).allow(null).optional(),
    note: Joi.string().trim().allow('').max(500).optional(),
  })

  router.post(
    '/inventory/alloy-mix/jobs/:id/add-metal',
    protect,
    validateParams(Joi.object({ id: Joi.string().trim().min(1).max(40).required() })),
    validateBody(alloyMixAddMetalSchema),
    async (req, res) => {
      try {
        if (!canWriteInventory(req.user)) {
          return res.status(403).json({ success: false, message: 'Forbidden' })
        }
        const { addMetalToVaultMix } = require('../../services/erpAccounting/alloyMixFloorBridge')
        const { runInTransaction } = require('../../utils/mongoTransaction')
        const job = await runInTransaction(async (session) => addMetalToVaultMix({
          user: req.user,
          mixId: req.params.id,
          productId: req.body.productId,
          gross: req.body.gross,
          purity: req.body.purity,
          note: req.body.note,
          session,
        }))
        emitAlloyMixProductionUpdate(req, 'alloy-mix-add-metal', {
          mixCode: job?.mixCode || null,
          department: job?.currentDepartment || 'vault_room',
          targetGross: job?.targetGross ?? null,
        })
        res.json({ success: true, job })
      } catch (error) {
        respondRouteError(res, error, { tag: 'erp-accounting/inventory/alloy-mix/jobs/add-metal' })
      }
    },
  )

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
  router.post('/inventory/alloy-mix/clear-history', protect, validateBody(alloyMixClearHistorySchema), async (req, res) => {
    try {
      // Same write gate as reverse — Delete on a history row must be able to purge it.
      if (!canWriteInventory(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const reasonBase = String(req.body?.reason || '').trim()
      const karatNum = Number(req.body?.karat)
      let reasonFilter
      if (reasonBase) {
        const escaped = reasonBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Posted list reason is the base; movements are `${base} — consume|receive …`.
        reasonFilter = new RegExp(`^${escaped}(?:\\s*[—\\-]\\s*(?:consume|receive)\\b|$)`, 'i')
      } else if (Number.isFinite(karatNum) && karatNum > 0) {
        reasonFilter = new RegExp(`Gold alloy mix\\s*\\(${karatNum}\\s*K|alloy mix\\s*\\(${karatNum}\\s*K`, 'i')
      } else {
        reasonFilter = /Gold alloy mix|alloy mix/i
      }
      const result = await StockMovement.deleteMany({
        isDeleted: true,
        reason: reasonFilter,
      })
      res.json({
        success: true,
        deletedCount: result.deletedCount || 0,
        reason: reasonBase || null,
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
