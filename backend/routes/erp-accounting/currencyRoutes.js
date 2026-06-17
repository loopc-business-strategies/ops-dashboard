const { normalizeTenant } = require('../../config/tenants')
const rateLimit = require('express-rate-limit')
const { publishRealtimeEvent } = require('../../utils/realtimeBus')
const {
  normalizeBridgeMetalRates,
  buildMetalRatesResponse,
  getBridgeTokenFromRequest,
} = require('../../services/erpAccounting/metalRateBridgeService')
const { createMetalPricingHelpers } = require('./reportRoutesMetalPricing')
const { notifyErpUsers } = require('../../services/notificationDispatch')
const { computeMarginMetricsRaw } = require('../../services/erpAccounting/metalMarginPolicy')
const {
  fetchFredPreciousMetalSpotBundle,
  fetchAlphaVantagePreciousMetalSpotBundle,
  fetchSilvDataPreciousMetalSpotBundle,
} = require('../../services/metalSpotFeeds')

const TROY_OUNCE_GRAMS = 31.1034768
const toMoney = (value) => Number(Number(value || 0).toFixed(2))

function marketSpotToLiveRates(market = {}) {
  const unit = String(market.unit || 'toz').toLowerCase()
  const perToz = unit === 'toz' || unit === 'oz'
  const metals = market.metals || {}
  const gold = Number(metals.gold) || 0
  const silver = Number(metals.silver) || 0
  const platinum = Number(metals.platinum) || 0
  if (gold <= 0 || silver <= 0 || platinum <= 0) return null

  const toGram = (price) => (perToz ? price / TROY_OUNCE_GRAMS : price)
  return {
    goldPrice: toGram(gold),
    silverPrice: toGram(silver),
    platinumPrice: toGram(platinum),
    priceCurrency: String(market.currency || 'USD').trim().toUpperCase() || 'USD',
    priceUnit: 'G',
    sourceGoldPrice: gold,
    sourceSilverPrice: silver,
    sourcePlatinumPrice: platinum,
    sourceUnit: perToz ? 'TOZ' : 'G',
    source: String(market.source || 'market').trim() || 'market',
    updatedAt: market.updatedAt || new Date(),
  }
}

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
    canReadErpReferenceData,
    canUpdateMetalRates,
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

  const resolveTenantBaseCurrencyCode = async () => {
    const base = await Currency.findOne({ baseCurrency: true, isActive: { $ne: false } })
      .select('code')
      .lean()
    return String(base?.code || BASE_CURRENCY_CODE || 'USD').trim().toUpperCase() || 'USD'
  }

  const {
    fetchExternalMetalPrices,
    buildFallbackMetalPrices,
    getCurrencyMultiplier,
  } = createMetalPricingHelpers(
    { Currency, InventoryItem, MetalRate, toMoney },
    computeMarginMetricsRaw,
  )

  const scaleUsdPerOzMetalsToRequest = async (metalsObj, currency, unit) => {
    const mult = await getCurrencyMultiplier('USD', currency)
    const unitFactor = String(unit || 'toz').toLowerCase() === 'g'
      ? 1 / TROY_OUNCE_GRAMS
      : String(unit || 'toz').toLowerCase() === 'kg'
        ? 32.1507465686
        : 1
    const out = {}
    for (const k of ['gold', 'silver', 'platinum', 'palladium']) {
      const raw = Number(metalsObj[k] || 0)
      out[k] = Number.isFinite(raw) && raw > 0 ? toMoney(raw * mult * unitFactor) : 0
    }
    return out
  }

  const resolveServerMarketSpot = async ({ currency = 'USD', unit = 'toz' } = {}) => {
    const fredKey = String(process.env.FRED_API_KEY || '').trim()
    const alphaKey = String(process.env.METALS_ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || '').trim()
    let market

    try {
      market = await fetchExternalMetalPrices({ currency, unit })
    } catch {
      // try other providers below
    }

    if (!market) {
      try {
        const rawSilv = await fetchSilvDataPreciousMetalSpotBundle()
        market = {
          ...rawSilv,
          metals: await scaleUsdPerOzMetalsToRequest(rawSilv.metals, currency, unit),
          currency: String(currency || 'USD').toUpperCase(),
          unit: String(unit || 'toz').toLowerCase(),
        }
      } catch {
        // try FRED
      }
    }

    if (!market && fredKey) {
      try {
        const rawFred = await fetchFredPreciousMetalSpotBundle()
        market = {
          ...rawFred,
          metals: await scaleUsdPerOzMetalsToRequest(rawFred.metals, currency, unit),
          currency: String(currency || 'USD').toUpperCase(),
          unit: String(unit || 'toz').toLowerCase(),
        }
      } catch {
        // try Alpha Vantage
      }
    }

    if (!market && alphaKey) {
      try {
        const rawAv = await fetchAlphaVantagePreciousMetalSpotBundle({ apiKey: alphaKey })
        market = {
          ...rawAv,
          metals: await scaleUsdPerOzMetalsToRequest(rawAv.metals, currency, unit),
          currency: String(currency || 'USD').toUpperCase(),
          unit: String(unit || 'toz').toLowerCase(),
        }
      } catch {
        // use inventory / saved fallback
      }
    }

    if (!market) {
      market = await buildFallbackMetalPrices({ currency, unit })
    }

    return market
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const metalRatesBridgeLimiter = rateLimit({
    windowMs: Number(process.env.METAL_RATES_BRIDGE_RATE_LIMIT_WINDOW_MS || 60 * 1000),
    max: Number(process.env.METAL_RATES_BRIDGE_RATE_LIMIT_MAX || 120),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    message: { success: false, message: 'Too many metal rates bridge requests.' },
  })

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
      if (!canReadErpReferenceData(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
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
      if (!canReadErpReferenceData(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
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
        'address',
        'phone',
        'trn',
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
      const latest = await getLatestMetalRate()
      const { stockPriceMap, latestStockUpdatedAt } = await resolveInventoryMetalRates()
      const preferSavedLiveRate = latest && !['manual', 'default'].includes(String(latest.source || '').toLowerCase())

      const rates = {
        goldPrice: preferSavedLiveRate ? Number(latest.goldPrice || 0) : (stockPriceMap.gold?.price || (latest ? Number(latest.goldPrice || 0) : Number(DEFAULT_METAL_RATES.goldPrice || 0))),
        silverPrice: preferSavedLiveRate ? Number(latest.silverPrice || 0) : (stockPriceMap.silver?.price || (latest ? Number(latest.silverPrice || 0) : Number(DEFAULT_METAL_RATES.silverPrice || 0))),
        platinumPrice: preferSavedLiveRate ? Number(latest.platinumPrice || 0) : (stockPriceMap.platinum?.price || (latest ? Number(latest.platinumPrice || 0) : 0)),
        priceCurrency: preferSavedLiveRate ? latest.priceCurrency : (stockPriceMap.gold?.currency || stockPriceMap.silver?.currency || (latest ? latest.priceCurrency : DEFAULT_METAL_RATES.priceCurrency || 'USD')),
        priceUnit: preferSavedLiveRate ? (latest.priceUnit || 'G') : (stockPriceMap.gold?.unit || stockPriceMap.silver?.unit || stockPriceMap.platinum?.unit || latest?.priceUnit || 'G'),
        source: latest?.source || (latestStockUpdatedAt ? 'inventory' : 'default'),
        updatedAt: preferSavedLiveRate ? latest.updatedAt : (latestStockUpdatedAt || (latest ? latest.updatedAt : null)),
      }

      res.json({
        success: true,
        rates,
        canUpdate: canUpdateMetalRates(req.user),
      })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.get('/metal-rates/live', protect, async (req, res) => {
    try {
      const baseCurrencyCode = await resolveTenantBaseCurrencyCode()
      const staleMs = Math.max(5000, Number(process.env.MT4_LIVE_STALE_MS || 30000))
      const latestFeed = await MetalRate.findOne({
        source: 'mt4-bridge',
        goldPrice: { $gt: 0 },
        silverPrice: { $gt: 0 },
        platinumPrice: { $gt: 0 },
      }).sort({ updatedAt: -1 })

      const updatedAt = latestFeed?.updatedAt ? new Date(latestFeed.updatedAt) : null
      const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : Number.POSITIVE_INFINITY
      const isFresh = Boolean(latestFeed && ageMs <= staleMs)

      if (!isFresh) {
        try {
          const market = await resolveServerMarketSpot({ currency: 'USD', unit: 'toz' })
          const marketRates = marketSpotToLiveRates(market)
          if (marketRates) {
            return res.json({
              success: true,
              live: true,
              feedType: 'market',
              message: latestFeed
                ? 'MT4 feed stale — showing server market prices.'
                : 'Waiting for MT4 — showing server market prices.',
              rates: marketRates,
              canUpdate: canUpdateMetalRates(req.user),
              staleMs,
              feedAgeMs: Number.isFinite(ageMs) ? ageMs : null,
            })
          }
        } catch (err) {
          console.warn('[metal-rates live] market fallback failed:', err?.message || err)
        }

        return res.json({
          success: true,
          live: false,
          message: latestFeed
            ? 'MT4 feed stale — check MT4 bridge and AutoTrading.'
            : 'Waiting for MT4 live feed.',
          rates: {
            goldPrice: 0,
            silverPrice: 0,
            platinumPrice: 0,
            priceCurrency: baseCurrencyCode,
            priceUnit: 'G',
            source: 'waiting-mt4',
            updatedAt: updatedAt || null,
          },
          canUpdate: canUpdateMetalRates(req.user),
          staleMs,
          feedAgeMs: Number.isFinite(ageMs) ? ageMs : null,
        })
      }

      res.json({
        success: true,
        live: true,
        rates: buildMetalRatesResponse(latestFeed),
        canUpdate: canUpdateMetalRates(req.user),
        staleMs,
        feedAgeMs: ageMs,
      })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.put('/metal-rates', protect, async (req, res) => {
    try {
      if (!canUpdateMetalRates(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

      const goldPrice = Number(req.body.goldPrice)
      const silverPrice = Number(req.body.silverPrice)
      const platinumPrice = Number(req.body.platinumPrice || 0)
      const priceCurrency = await resolveTenantBaseCurrencyCode()

      if (!Number.isFinite(goldPrice) || goldPrice <= 0 || !Number.isFinite(silverPrice) || silverPrice <= 0) {
        return res.status(400).json({ success: false, message: 'Gold and silver rates must be greater than zero' })
      }

      const rate = await MetalRate.create({
        goldPrice,
        silverPrice,
        platinumPrice: Number.isFinite(platinumPrice) && platinumPrice > 0 ? platinumPrice : 0,
        priceCurrency,
        priceUnit: 'G',
        source: 'manual',
        updatedBy: req.user._id,
      })

      res.json({
        success: true,
        rates: buildMetalRatesResponse(rate),
      })
    } catch {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  })

  router.post('/metal-rates/bridge', metalRatesBridgeLimiter, async (req, res) => {
    try {
      const expectedToken = String(process.env.METAL_RATES_BRIDGE_TOKEN || '').trim()
      if (!expectedToken) {
        console.warn('[metal-rates bridge] rejected POST: METAL_RATES_BRIDGE_TOKEN is not configured')
        return res.status(503).json({ success: false, message: 'Metal rates bridge is not configured.' })
      }

      const token = getBridgeTokenFromRequest(req)
      if (!token || token !== expectedToken) {
        console.warn('[metal-rates bridge] rejected POST: invalid bridge token')
        return res.status(401).json({ success: false, message: 'Invalid metal rates bridge token.' })
      }

      const tenant = normalizeTenant(req.headers['x-tenant'] || req.headers['x-company'] || req.body.tenant)
      if (!tenant) {
        console.warn('[metal-rates bridge] rejected POST: valid tenant is required', {
          headerTenant: req.headers['x-tenant'] || req.headers['x-company'] || '',
          bodyTenant: req.body?.tenant || '',
        })
        return res.status(400).json({ success: false, message: 'Valid tenant is required.' })
      }

      const TenantMetalRate = await MetalRate.getTenantModel(tenant)
      const latest = await TenantMetalRate.findOne({}).sort({ updatedAt: -1 })
      const oldGold = Number(latest?.goldPrice || 0)
      const normalized = normalizeBridgeMetalRates(req.body, latest || DEFAULT_METAL_RATES)
      const rate = await TenantMetalRate.findOneAndUpdate(
        { source: normalized.source },
        {
          $set: {
            goldPrice: normalized.goldPrice,
            silverPrice: normalized.silverPrice,
            platinumPrice: normalized.platinumPrice,
            priceCurrency: normalized.priceCurrency,
            priceUnit: normalized.priceUnit,
            source: normalized.source,
            sourcePayload: {
              sourceUnit: normalized.sourceUnit,
              sourcePrices: normalized.sourcePrices,
              symbols: req.body.symbols || undefined,
              receivedAt: new Date(),
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      const rates = buildMetalRatesResponse(rate)
      req.app.get('realtimeServer')?.broadcastMetalRatesUpdate?.(tenant, { rates })
      publishRealtimeEvent({ type: 'metal-rates:update', tenant, data: { rates } })
      console.info('[metal-rates bridge] accepted live metal rates', {
        tenant,
        source: normalized.source,
        symbols: req.body.symbols || {},
        updatedAt: rate.updatedAt,
      })

      const newGold = Number(rate.goldPrice || 0)
      if (oldGold > 0 && newGold > 0) {
        const changePct = ((newGold - oldGold) / oldGold) * 100
        const threshold = Number(process.env.GOLD_ALERT_PCT || 0.5)
        if (Math.abs(changePct) >= threshold) {
          void notifyErpUsers(tenant, 'gold_price_alert', {
            price: newGold,
            changePct,
            message: `Gold moved ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% to ${newGold.toFixed(2)}`,
          }).catch((err) => console.warn('[notify] gold_price_alert', err?.message || err))
        }
      }

      res.json({ success: true, tenant, rates })
    } catch (err) {
      const message = err?.message || 'Invalid metal rates payload'
      console.warn('[metal-rates bridge] rejected POST: invalid payload', {
        message,
        tenant: req.headers['x-tenant'] || req.headers['x-company'] || req.body?.tenant || '',
        symbols: req.body?.symbols || {},
      })
      res.status(message.includes('required') ? 400 : 500).json({ success: false, message })
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
