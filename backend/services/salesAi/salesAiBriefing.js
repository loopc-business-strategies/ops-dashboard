const { buildCrmSnapshot } = require('./crmSnapshot')
const { buildMetalRatesSnapshot } = require('./metalRatesSnapshot')
const { tavilySearch } = require('./tavilySearch')
const { buildRecommendations } = require('./agents/templateStrategyAgent')

const BRIEFING_MARKET_QUERY = 'Latest gold and silver jewelry wholesale market trends Central Asia Middle East UAE 2026'

const marketCache = new Map()

function getBriefingCacheTtlMs() {
  return Number(process.env.SALES_AI_BRIEFING_CACHE_MS) || 4 * 60 * 60 * 1000
}

function splitIntoBullets(text, max = 2) {
  const cleaned = String(text || '').trim()
  if (!cleaned) return []
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
  if (parts.length) return parts.slice(0, max)
  return [cleaned.slice(0, 280)]
}

function buildMarketBlockFromSearch(searchResult, cachedUntil, fromCache) {
  const results = searchResult?.results || []
  const answer = String(searchResult?.answer || '').trim()
  const first = results[0]
  const bullets = splitIntoBullets(answer, 2)
  if (!bullets.length && first?.content) {
    bullets.push(String(first.content).trim().slice(0, 280))
  }

  return {
    headline: answer ? answer.slice(0, 120) : (first?.title || 'Market trends'),
    bullets,
    source: first ? { title: first.title || first.url, url: first.url } : null,
    cachedUntil: cachedUntil.toISOString(),
    fromCache,
  }
}

async function fetchMarketBriefing(tenantKey = 'loopc') {
  const ttl = getBriefingCacheTtlMs()
  const now = Date.now()
  const cached = marketCache.get(tenantKey)
  if (cached && cached.expiresAt > now) {
    return buildMarketBlockFromSearch(cached.payload, new Date(cached.expiresAt), true)
  }

  const searchResult = await tavilySearch(BRIEFING_MARKET_QUERY, { maxResults: 3, includeAnswer: true })
  if (searchResult.error && !(searchResult.results || []).length && !searchResult.answer) {
    return null
  }

  const expiresAt = now + ttl
  marketCache.set(tenantKey, { payload: searchResult, expiresAt })
  return buildMarketBlockFromSearch(searchResult, new Date(expiresAt), false)
}

function buildCrmHighlight(crmSnapshot) {
  if (crmSnapshot?.accessLevel !== 'full' || !crmSnapshot?.detail) return undefined
  const topDeal = crmSnapshot.detail.topOpenDeals?.[0]
  const recentLead = crmSnapshot.detail.recentLeads?.[0]
  if (!topDeal && !recentLead) return undefined
  return {
    topDeal: topDeal ? {
      title: topDeal.title,
      stage: topDeal.stage,
      valueUSD: topDeal.valueUSD,
    } : undefined,
    recentLead: recentLead ? {
      title: recentLead.title,
      temperature: recentLead.temperature,
      companyName: recentLead.companyName,
    } : undefined,
  }
}

function buildMarketSectionForSuggestions(market) {
  if (!market?.source?.url) return { sources: [] }
  return {
    sources: [{ title: market.source.title, url: market.source.url }],
    answers: market.bullets || [],
  }
}

async function buildSalesAiBriefing(user, options = {}) {
  const tenantKey = String(user?.company || 'loopc').toLowerCase()
  const generatedAt = new Date()

  const [crmSnapshot, metalRates, market] = await Promise.all([
    buildCrmSnapshot(user),
    buildMetalRatesSnapshot(),
    options.skipMarket ? Promise.resolve(null) : fetchMarketBriefing(tenantKey),
  ])

  const marketSection = buildMarketSectionForSuggestions(market)
  const rawSuggestions = buildRecommendations(crmSnapshot, marketSection)

  return {
    generatedAt: generatedAt.toISOString(),
    metals: {
      goldPrice: metalRates.goldPrice,
      silverPrice: metalRates.silverPrice,
      priceCurrency: metalRates.priceCurrency,
      priceUnit: metalRates.priceUnit,
      source: metalRates.source,
      updatedAt: metalRates.updatedAt,
    },
    crm: {
      accessLevel: crmSnapshot.accessLevel,
      summary: crmSnapshot.summary,
      highlight: buildCrmHighlight(crmSnapshot),
    },
    market: market || null,
    suggestions: rawSuggestions.slice(0, 3),
  }
}

function clearBriefingMarketCacheForTests() {
  marketCache.clear()
}

module.exports = {
  buildSalesAiBriefing,
  fetchMarketBriefing,
  clearBriefingMarketCacheForTests,
  BRIEFING_MARKET_QUERY,
  getBriefingCacheTtlMs,
}
