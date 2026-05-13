function registerCurrencyRoutes(deps) {
  const {
    router,
    protect,
    validateBody,
    validateParams,
    currencyCreateSchema,
    currencyPatchSchema,
    idParam,
    Currency,
    ReportBranding,
    MetalRate,
    InventoryItem,
    canViewAccounts,
    canManageAccounts,
    ensureDefaultCurrencyMaster,
    ensureBaseCurrencyConfig,
    normalizeBrandingKey,
    buildBrandingPayload,
    buildBrandingProfiles,
    DEFAULT_REPORT_BRANDING,
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
    BASE_CURRENCY_CODE,
  } = deps

  const parseCategoryMeta = (category) => {
    const meta = {}
    String(category || '').split(';').forEach((pair) => {
      const [key, ...rest] = String(pair).split('=')
      if (!key || rest.length === 0) return
      meta[String(key).trim()] = rest.join('=').trim()
    })
    return meta
  }

  const resolveInventoryMetalRates = async () => {
    const stockTypeDocs = await InventoryItem.find({
      isDeleted: { $ne: true },
      $and: [
        { category: /mainStock=/i },
        { category: { $not: /recordType=product/i } },
      ],
    }).select('category unitCost currency updatedAt')

    const stockPriceMap = {}

    stockTypeDocs.forEach((doc) => {
      const meta = parseCategoryMeta(doc.category)
      const metal = String(meta.mainStock || meta.metalType || '').trim().toLowerCase()
      if (!metal) return

      const price = Number(doc.unitCost || 0)
      if (!Number.isFinite(price) || price <= 0) return

      const prev = stockPriceMap[metal]
      if (!prev || new Date(doc.updatedAt || 0) > new Date(prev.updatedAt || 0)) {
        stockPriceMap[metal] = {
          price,
          currency: String(doc.currency || meta.priceCurrency || 'USD').toUpperCase(),
          unit: String(meta.priceUnit || 'OZ').toUpperCase(),
          updatedAt: doc.updatedAt || null,
        }
      }
    })

    const latestStockUpdatedAt = Object.values(stockPriceMap)
      .map((entry) => entry.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null

    return {
      stockPriceMap,
      latestStockUpdatedAt,
    }
  }

  router.get('/currencies', protect, async (req, res) => {
    try {
      if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      await ensureDefaultCurrencyMaster()
      const currencies = await Currency.find({}).sort({ baseCurrency: -1, code: 1 })
      res.json({ success: true, currencies, total: currencies.length, page: 1, limit: currencies.length })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.post('/currencies/seed-defaults', protect, async (req, res) => {
    try {
      if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const result = await ensureDefaultCurrencyMaster()
      const currencies = await Currency.find({}).sort({ baseCurrency: -1, code: 1 })

      res.json({
        success: true,
        message: 'Currency master defaults synchronized.',
        createdCount: result.createdCount,
        normalizedCount: result.normalizedCount,
        currencies,
      })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.get('/report-branding', protect, async (req, res) => {
    try {
      if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const requestedKey = normalizeBrandingKey(req.query.key || 'default')
      const profiles = await ReportBranding.find({}).sort({ isDefault: -1, entityName: 1, branchName: 1, key: 1 })
      const selectedDoc = profiles.find((doc) => doc.key === requestedKey) || profiles.find((doc) => doc.isDefault) || null
      const branding = buildBrandingPayload(selectedDoc)
      res.json({ success: true, branding, profiles: buildBrandingProfiles(profiles), selectedKey: branding.key })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.put('/report-branding', protect, async (req, res) => {
    try {
      if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
      const key = normalizeBrandingKey(req.body.key || 'default')
      const existing = await ReportBranding.findOne({ key })
      const allowedFields = [
        'entityName',
        'branchName',
        'companyName',
        'legalName',
        'reportSubtitle',
        'logoUrl',
        'logoWidth',
        'logoHeight',
        'logoFit',
        'reportFooter',
        'preparedByTitle',
        'preparedByName',
        'reviewedByTitle',
        'reviewedByName',
        'approvedByTitle',
        'approvedByName',
      ]
      const updates = { key, updatedBy: req.user._id }
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field]
      })

      updates.logoWidth = Number.isFinite(Number(updates.logoWidth)) ? Math.min(Math.max(Number(updates.logoWidth), 80), 260) : (existing?.logoWidth || DEFAULT_REPORT_BRANDING.logoWidth)
      updates.logoHeight = Number.isFinite(Number(updates.logoHeight)) ? Math.min(Math.max(Number(updates.logoHeight), 32), 120) : (existing?.logoHeight || DEFAULT_REPORT_BRANDING.logoHeight)
      updates.logoFit = ['contain', 'cover', 'fill'].includes(updates.logoFit) ? updates.logoFit : (existing?.logoFit || DEFAULT_REPORT_BRANDING.logoFit)

      const isDefault = req.body.isDefault !== undefined ? Boolean(req.body.isDefault) : (existing?.isDefault || key === 'default')
      updates.isDefault = isDefault

      if (isDefault) {
        await ReportBranding.updateMany({ key: { $ne: key } }, { $set: { isDefault: false } })
      }

      const branding = await ReportBranding.findOneAndUpdate(
        { key },
        { $set: updates },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
      )

      const profiles = await ReportBranding.find({}).sort({ isDefault: -1, entityName: 1, branchName: 1, key: 1 })
      res.json({ success: true, branding: buildBrandingPayload(branding), profiles: buildBrandingProfiles(profiles), selectedKey: branding.key })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.get('/metal-rates', protect, async (req, res) => {
    try {
      if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const latest = await getLatestMetalRate()
      const { stockPriceMap, latestStockUpdatedAt } = await resolveInventoryMetalRates()

      const rates = {
        goldPrice: stockPriceMap.gold?.price || (latest ? Number(latest.goldPrice || 0) : Number(DEFAULT_METAL_RATES.goldPrice || 0)),
        silverPrice: stockPriceMap.silver?.price || (latest ? Number(latest.silverPrice || 0) : Number(DEFAULT_METAL_RATES.silverPrice || 0)),
        platinumPrice: stockPriceMap.platinum?.price || 0,
        priceCurrency: stockPriceMap.gold?.currency || stockPriceMap.silver?.currency || (latest ? latest.priceCurrency : DEFAULT_METAL_RATES.priceCurrency || 'USD'),
        priceUnit: stockPriceMap.gold?.unit || stockPriceMap.silver?.unit || stockPriceMap.platinum?.unit || 'OZ',
        updatedAt: latestStockUpdatedAt || (latest ? latest.updatedAt : null),
      }

      res.json({
        success: true,
        rates,
        canUpdate: canManageAccounts(req.user),
      })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.put('/metal-rates', protect, async (req, res) => {
    try {
      if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const goldPrice = Number(req.body.goldPrice)
      const silverPrice = Number(req.body.silverPrice)
      const priceCurrency = BASE_CURRENCY_CODE

      if (!Number.isFinite(goldPrice) || goldPrice <= 0 || !Number.isFinite(silverPrice) || silverPrice <= 0) {
        return res.status(400).json({ success: false, message: 'Gold and silver rates must be greater than zero' })
      }

      const rate = await MetalRate.create({
        goldPrice,
        silverPrice,
        priceCurrency,
        updatedBy: req.user._id,
      })

      res.json({
        success: true,
        rates: {
          goldPrice: Number(rate.goldPrice || 0),
          silverPrice: Number(rate.silverPrice || 0),
          priceCurrency: rate.priceCurrency,
          updatedAt: rate.updatedAt,
        },
      })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.post('/currencies', protect, validateBody(currencyCreateSchema), async (req, res) => {
    try {
      if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const code = String(req.body.code || '').trim().toUpperCase()
      const name = String(req.body.name || '').trim()
      const symbol = String(req.body.symbol || '').trim() || code
      const exchangeRate = Number(req.body.exchangeRate)
      const isActive = req.body.isActive === undefined ? true : Boolean(req.body.isActive)
      const wantsBase = Boolean(req.body.baseCurrency)

      if (!code || code.length < 2 || code.length > 10) {
        return res.status(400).json({ success: false, message: 'Currency code is required (2-10 chars).' })
      }
      if (!name) {
        return res.status(400).json({ success: false, message: 'Currency name is required.' })
      }
      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        return res.status(400).json({ success: false, message: 'Exchange rate must be greater than zero.' })
      }

      const existing = await Currency.findOne({ code })
      if (existing) {
        return res.status(409).json({ success: false, message: 'Currency code already exists.' })
      }

      const currency = await Currency.create({
        code,
        name,
        symbol,
        exchangeRate: wantsBase ? 1 : exchangeRate,
        rateUpdatedAt: new Date(),
        isActive,
        baseCurrency: false,
      })

      if (wantsBase) {
        await Currency.updateMany({ _id: { $ne: currency._id }, baseCurrency: true }, { $set: { baseCurrency: false } })
        currency.baseCurrency = true
        currency.exchangeRate = 1
        await currency.save()
      } else {
        await ensureBaseCurrencyConfig()
      }

      res.status(201).json({ success: true, currency })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.put('/currencies/:id', protect, validateParams(idParam), validateBody(currencyPatchSchema), async (req, res) => {
    try {
      if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const currency = await Currency.findById(req.params.id)
      if (!currency) {
        return res.status(404).json({ success: false, message: 'Currency not found.' })
      }

      const nextCode = req.body.code !== undefined ? String(req.body.code || '').trim().toUpperCase() : currency.code
      const nextName = req.body.name !== undefined ? String(req.body.name || '').trim() : currency.name
      const nextSymbol = req.body.symbol !== undefined ? String(req.body.symbol || '').trim() : currency.symbol
      const wantsBase = req.body.baseCurrency !== undefined ? Boolean(req.body.baseCurrency) : currency.baseCurrency
      const nextIsActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : currency.isActive
      const nextRate = req.body.exchangeRate !== undefined ? Number(req.body.exchangeRate) : Number(currency.exchangeRate || 1)

      if (!nextCode || nextCode.length < 2 || nextCode.length > 10) {
        return res.status(400).json({ success: false, message: 'Currency code is required (2-10 chars).' })
      }
      if (!nextName) return res.status(400).json({ success: false, message: 'Currency name is required.' })
      if (!nextSymbol) return res.status(400).json({ success: false, message: 'Currency symbol is required.' })
      if (!Number.isFinite(nextRate) || nextRate <= 0) {
        return res.status(400).json({ success: false, message: 'Exchange rate must be greater than zero.' })
      }
      if (currency.baseCurrency && !wantsBase) {
        return res.status(400).json({ success: false, message: 'At least one base currency is required.' })
      }
      if (currency.baseCurrency && !nextIsActive) {
        return res.status(400).json({ success: false, message: 'Base currency cannot be inactive.' })
      }

      const duplicate = await Currency.findOne({ code: nextCode, _id: { $ne: currency._id } })
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Currency code already exists.' })
      }

      currency.code = nextCode
      currency.name = nextName
      currency.symbol = nextSymbol
      currency.isActive = nextIsActive
      currency.baseCurrency = wantsBase
      currency.exchangeRate = wantsBase ? 1 : nextRate
      currency.rateUpdatedAt = new Date()
      await currency.save()

      if (wantsBase) {
        await Currency.updateMany({ _id: { $ne: currency._id }, baseCurrency: true }, { $set: { baseCurrency: false } })
      } else {
        await ensureBaseCurrencyConfig()
      }

      res.json({ success: true, currency })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.delete('/currencies/:id', protect, async (req, res) => {
    try {
      if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const currency = await Currency.findById(req.params.id)
      if (!currency) {
        return res.status(404).json({ success: false, message: 'Currency not found.' })
      }

      if (currency.baseCurrency) {
        return res.status(400).json({ success: false, message: 'Base currency cannot be deleted.' })
      }

      await Currency.deleteOne({ _id: currency._id })
      await ensureBaseCurrencyConfig()
      res.json({ success: true, message: 'Currency deleted.' })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })
}

module.exports = {
  registerCurrencyRoutes,
}

