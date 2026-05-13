function registerInventoryRoutes(deps) {
  const {
    router,
    protect,
    InventoryItem,
    StockMovement,
    Vendor,
    Ledger,
    ChartOfAccount,
    canAccessInventory,
    isSuperAdmin,
    isFinance,
    isOperations,
    isProduction,
    parsePagination,
    nextInventoryAccountCode,
    toMoney,
  } = deps

  router.get('/inventory/products', protect, async (req, res) => {
    try {
      if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
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

  router.post('/inventory/products', protect, async (req, res) => {
    try {
      if (!canAccessInventory(req.user) || !(isSuperAdmin(req.user) || isFinance(req.user) || isOperations(req.user) || isProduction(req.user))) {
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

  router.post('/inventory/stock-in', protect, async (req, res) => {
    try {
      if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
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

  router.post('/inventory/stock-out', protect, async (req, res) => {
    try {
      if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
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

  router.put('/inventory/products/:id', protect, async (req, res) => {
    try {
      if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
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

  router.delete('/inventory/products/:id', protect, async (req, res) => {
    try {
      if (!(isSuperAdmin(req.user) || isFinance(req.user))) return res.status(403).json({ success: false, message: 'Forbidden' })
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
      if (!canAccessInventory(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const { page, limit, skip } = parsePagination(req.query, 50, 200)
      const [movements, total] = await Promise.all([
        StockMovement.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
        StockMovement.countDocuments({}),
      ])
      res.json({ success: true, movements, total, page, limit })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.delete('/inventory/stock-ledger', protect, async (req, res) => {
    try {
      if (!isSuperAdmin(req.user) && !isFinance(req.user)) {
        return res.status(403).json({ success: false, message: 'Forbidden' })
      }
      const result = await StockMovement.deleteMany({})
      res.json({ success: true, deletedCount: result.deletedCount || 0 })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })
}

module.exports = {
  registerInventoryRoutes,
}