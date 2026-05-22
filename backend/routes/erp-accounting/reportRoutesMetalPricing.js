/**
 * Metal / FX helper closures for ERP report routes (extracted from reportRoutes.js).
 * @param {{ Currency: object, InventoryItem: object, MetalRate: object, toMoney: function }} partialDeps
 * @param {function} computeMarginMetricsRaw from metalMarginPolicy
 */
function createMetalPricingHelpers(partialDeps, computeMarginMetricsRaw) {
  const { Currency, InventoryItem, MetalRate, toMoney } = partialDeps

  const isUnfixedFixingType = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
  }
  const roundPosition = (value) => Number(Number(value || 0).toFixed(6))
  const calculateMarginMetrics = ({
    totalFunds,
    goldPosition,
    silverPosition,
    goldPrice,
    silverPrice,
    suppressMetalSpotMtm = false,
    revaluationOverride = null,
  }) => {
    const raw = computeMarginMetricsRaw({
      totalFunds,
      goldPosition,
      silverPosition,
      goldPrice,
      silverPrice,
      suppressMetalSpotMtm,
      revaluationOverride,
      fundsMode: 'asIs',
    })
    return {
      totalFunds: toMoney(raw.funds),
      revaluation: toMoney(raw.revaluation),
      margin: toMoney(raw.margin),
      equity: toMoney(raw.equity),
      excess: toMoney(raw.excess),
      marginPercent: toMoney(raw.marginPercent),
      status: raw.status,
    }
  }

  const normalizeMetalPayload = (payload, requestedCurrency = 'USD', requestedUnit = 'toz') => {
    const metals = payload?.metals || payload?.rates || {}
    const sourceCurrency = String(payload?.currency || requestedCurrency || 'USD').toUpperCase()
    const sourceUnit = String(payload?.unit || requestedUnit || 'toz').toLowerCase()
    const lookup = (keys) => {
      for (const key of keys) {
        const raw = metals[key] ?? payload?.[key]
        const value = typeof raw === 'object' && raw !== null && 'price' in raw ? raw.price : raw
        const number = Number(value)
        if (Number.isFinite(number) && number > 0) return number
      }
      return 0
    }

    return {
      source: payload?.source || 'metals.dev',
      currency: sourceCurrency,
      unit: sourceUnit,
      updatedAt: payload?.timestamp || payload?.updatedAt || new Date(),
      currencies: payload?.currencies || {},
      metals: {
        gold: lookup(['gold', 'XAU', 'xau']),
        silver: lookup(['silver', 'XAG', 'xag']),
        platinum: lookup(['platinum', 'XPT', 'xpt']),
        palladium: lookup(['palladium', 'XPD', 'xpd']),
      },
    }
  }

  const getCurrencyMultiplier = async (fromCurrency, toCurrency) => {
    const from = String(fromCurrency || 'USD').toUpperCase()
    const to = String(toCurrency || 'USD').toUpperCase()
    if (from === to) return 1
    if (to === 'USD') {
      const fromDoc = await Currency.findOne({ code: from, isActive: true }).select('exchangeRate')
      const fromRate = Number(fromDoc?.exchangeRate || 0)
      return fromRate > 0 ? 1 / fromRate : 1
    }
    const targetDoc = await Currency.findOne({ code: to, isActive: true }).select('exchangeRate')
    const targetRate = Number(targetDoc?.exchangeRate || 0)
    return targetRate > 0 ? targetRate : 1
  }

  const buildInventoryMetalPriceMap = async () => {
    const stockTypeDocs = await InventoryItem.find({
      isDeleted: { $ne: true },
      $and: [
        { category: /mainStock=/i },
        { category: { $not: /recordType=product/i } },
      ],
    }).select('category unitCost currency updatedAt')

    const stockPriceMap = {}
    stockTypeDocs.forEach((doc) => {
      const raw = String(doc.category || '')
      const meta = {}
      raw.split(';').forEach((pair) => {
        const [key, ...rest] = pair.split('=')
        if (!key || rest.length === 0) return
        meta[String(key).trim()] = rest.join('=').trim()
      })
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

    return stockPriceMap
  }

  const normalizeMetalsDevApiKey = (raw) => {
    let k = String(raw || '').trim()
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
      k = k.slice(1, -1).trim()
    }
    return k.replace(/^\uFEFF/, '').replace(/\r?\n/g, '').replace(/\s+/g, '')
  }

  const fetchExternalMetalPrices = async ({ currency = 'USD', unit = 'toz' } = {}) => {
    const apiKey = normalizeMetalsDevApiKey(process.env.METALS_DEV_API_KEY || process.env.METALS_API_KEY || '')
    const defaultMetalsDev = 'https://api.metals.dev/v1/latest'
    const configuredUrl = String(process.env.METALS_MARKET_URL || '').trim()
    const targetUrl = configuredUrl || defaultMetalsDev
    const norm = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase()
    const usingDefaultMetalsDev = norm(targetUrl) === norm(defaultMetalsDev)

    if (usingDefaultMetalsDev && !apiKey) {
      throw new Error(
        'Live spot feed needs METALS_DEV_API_KEY on the backend (see ENV-VARS-QUICK-REFERENCE.md). metals.dev requires a key; until then, inventory or saved metal rates are used.'
      )
    }

    const buildUrl = (includeUnit) => {
      const u = new URL(targetUrl)
      u.searchParams.set('currency', String(currency || 'USD').toUpperCase())
      if (includeUnit) u.searchParams.set('unit', String(unit || 'toz').toLowerCase())
      if (apiKey) u.searchParams.set('api_key', apiKey)
      return u.toString()
    }

    const parseMetalsDevError = (bodyText) => {
      let detail = String(bodyText || '').slice(0, 400).replace(/\s+/g, ' ').trim()
      try {
        const errJson = JSON.parse(bodyText)
        const code = errJson.error_code != null ? `[${errJson.error_code}] ` : ''
        detail = String(
          errJson.error_message
            || errJson.message
            || errJson.error
            || (errJson.status && errJson.status !== 'failure' ? errJson.status : '')
            || detail
        ).trim()
        if (!detail && errJson.status === 'failure') detail = 'Request rejected (see metals.dev dashboard / quota / API key).'
        return `${code}${detail}`.slice(0, 400)
      } catch {
        return detail
      }
    }

    const fetchOnce = async (urlStr) => {
      const response = await fetch(urlStr, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      const text = await response.text()
      return { response, text }
    }

    let { response, text } = await fetchOnce(buildUrl(true))
    if (!response.ok && (response.status === 400 || response.status === 401)) {
      const retry = await fetchOnce(buildUrl(false))
      if (retry.response.ok) {
        response = retry.response
        text = retry.text
      }
    }

    if (!response.ok) {
      const detail = parseMetalsDevError(text)
      throw new Error(`metals provider returned ${response.status}${detail ? `: ${detail}` : ''}`)
    }
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error('metals provider returned non-JSON body')
    }
    if (payload && typeof payload === 'object' && String(payload.status || '').toLowerCase() === 'failure') {
      const detail = parseMetalsDevError(text)
      throw new Error(detail || 'metals.dev returned failure status')
    }
    const normalized = normalizeMetalPayload(payload, currency, unit)
    const hasAny = Object.values(normalized.metals || {}).some((n) => Number(n) > 0)
    if (!hasAny) throw new Error('metals provider returned no usable prices')

    return {
      ...normalized,
      source: normalized.source || (usingDefaultMetalsDev ? 'metals.dev' : 'external-metals'),
    }
  }

  const buildFallbackMetalPrices = async ({ currency = 'USD', unit = 'toz' } = {}) => {
    const [latestRate, stockPriceMap] = await Promise.all([
      MetalRate.findOne().sort({ updatedAt: -1 }),
      buildInventoryMetalPriceMap(),
    ])
    const sourceCurrency = stockPriceMap.gold?.currency || stockPriceMap.silver?.currency || (latestRate ? latestRate.priceCurrency : 'USD')
    const multiplier = await getCurrencyMultiplier(sourceCurrency, currency)
    const latestStockUpdatedAt = Object.values(stockPriceMap)
      .map((entry) => entry.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null

    const perOz = {
      gold: stockPriceMap.gold?.price || (latestRate ? latestRate.goldPrice : 0),
      silver: stockPriceMap.silver?.price || (latestRate ? latestRate.silverPrice : 0),
      platinum: stockPriceMap.platinum?.price || 0,
      palladium: stockPriceMap.palladium?.price || 0,
    }
    const unitFactor = String(unit || 'toz').toLowerCase() === 'g'
      ? 1 / 31.1034768
      : String(unit || 'toz').toLowerCase() === 'kg'
        ? 32.1507465686
        : 1

    return {
      source: latestStockUpdatedAt ? 'inventory' : 'local-metal-rate',
      currency: String(currency || sourceCurrency || 'USD').toUpperCase(),
      unit: String(unit || 'toz').toLowerCase(),
      updatedAt: latestStockUpdatedAt || latestRate?.updatedAt || null,
      metals: Object.fromEntries(Object.entries(perOz).map(([metal, price]) => [metal, toMoney(Number(price || 0) * multiplier * unitFactor)])),
      stockPrices: stockPriceMap,
    }
  }

  const buildMetalRates = async () => {
    const [latestRate, stockPriceMap] = await Promise.all([
      MetalRate.findOne().sort({ updatedAt: -1 }),
      buildInventoryMetalPriceMap(),
    ])
    const latestStockUpdatedAt = Object.values(stockPriceMap)
      .map((entry) => entry.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null

    return {
      gold: stockPriceMap.gold?.price || (latestRate ? latestRate.goldPrice : 0),
      silver: stockPriceMap.silver?.price || (latestRate ? latestRate.silverPrice : 0),
      platinum: stockPriceMap.platinum?.price || 0,
      palladium: stockPriceMap.palladium?.price || 0,
      currency: stockPriceMap.gold?.currency || stockPriceMap.silver?.currency || (latestRate ? latestRate.priceCurrency : 'USD'),
      updatedAt: latestStockUpdatedAt || (latestRate ? latestRate.updatedAt : null),
      stockPrices: stockPriceMap,
    }
  }

  return {
    isUnfixedFixingType,
    roundPosition,
    calculateMarginMetrics,
    normalizeMetalPayload,
    getCurrencyMultiplier,
    buildInventoryMetalPriceMap,
    normalizeMetalsDevApiKey,
    fetchExternalMetalPrices,
    buildFallbackMetalPrices,
    buildMetalRates,
  }
}

module.exports = { createMetalPricingHelpers }
