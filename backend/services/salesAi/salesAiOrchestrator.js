const { buildSearchQueries } = require('./salesAiPrompts')
const { runTavilySearches } = require('./tavilySearch')
const { buildCrmSnapshot } = require('./crmSnapshot')
const { buildMetalRatesSnapshot } = require('./metalRatesSnapshot')
const { runMarketResearchAgent } = require('./agents/marketResearchAgent')
const { runCrmInsightAgent } = require('./agents/crmInsightAgent')
const { runStrategyAgent, getModel } = require('./agents/strategyAgent')
const { runTemplateStrategyAgent, isOpenAiQuotaError } = require('./agents/templateStrategyAgent')
const { isOpenAiConfigured } = require('./openAiClient')

function getSynthesisMode() {
  const raw = String(process.env.SALES_AI_SYNTHESIS_MODE || 'auto').trim().toLowerCase()
  if (['template', 'openai', 'auto'].includes(raw)) return raw
  return 'auto'
}

function shouldPreferTemplate() {
  const mode = getSynthesisMode()
  if (mode === 'template') return true
  if (mode === 'openai') return false
  return !isOpenAiConfigured()
}

async function runSynthesis({
  userMessage,
  marketSection,
  crmSection,
  crmSnapshot,
  metalRates,
  pageContext,
  history,
}) {
  if (shouldPreferTemplate()) {
    return runTemplateStrategyAgent({
      userMessage,
      marketSection,
      crmSnapshot,
      metalRates,
      fallbackReason: isOpenAiConfigured() ? 'quota_or_policy' : 'disabled',
    })
  }

  try {
    return await runStrategyAgent({
      userMessage,
      marketSection,
      crmSection,
      metalRates,
      pageContext,
      history,
    })
  } catch (err) {
    if (getSynthesisMode() === 'auto' && isOpenAiQuotaError(err)) {
      return runTemplateStrategyAgent({
        userMessage,
        marketSection,
        crmSnapshot,
        metalRates,
        fallbackReason: 'quota',
      })
    }
    throw err
  }
}

async function runSalesAiChat({
  user,
  message,
  history = [],
  pageContext = {},
}) {
  const userMessage = String(message || '').trim()
  if (!userMessage) {
    throw new Error('Message is required.')
  }

  const queries = buildSearchQueries(userMessage)
  const [searchBatches, crmSnapshot, metalRates] = await Promise.all([
    runTavilySearches(queries),
    buildCrmSnapshot(user),
    buildMetalRatesSnapshot(),
  ])

  const marketSection = runMarketResearchAgent(searchBatches)
  const crmSection = runCrmInsightAgent(crmSnapshot)

  const strategy = await runSynthesis({
    userMessage,
    marketSection,
    crmSection,
    crmSnapshot,
    metalRates,
    pageContext,
    history,
  })

  const sections = [
    {
      title: marketSection.title,
      agent: marketSection.agent,
      sources: marketSection.sources,
    },
    {
      title: crmSection.title,
      agent: crmSection.agent,
    },
    {
      title: strategy.title,
      agent: strategy.agent,
    },
    ...strategy.sections,
  ]

  const synthesisMode = strategy.meta?.synthesisMode
    || (strategy.meta?.model === 'template' ? 'template' : 'openai')

  return {
    reply: strategy.reply,
    sections,
    meta: {
      tenant: user?.company || 'loopc',
      model: strategy.meta?.model || getModel(),
      synthesisMode,
      searchQueryCount: queries.length,
      crmAccessLevel: crmSnapshot?.accessLevel || 'none',
    },
  }
}

function getSalesAiConfig() {
  const tavilyReady = Boolean(String(process.env.TAVILY_API_KEY || '').trim())
  const openaiReady = isOpenAiConfigured()
  const synthesisMode = getSynthesisMode()
  const effectiveMode = synthesisMode === 'auto'
    ? (openaiReady ? 'auto' : 'template')
    : synthesisMode
  return {
    enabled: true,
    tenantScope: 'loopc',
    providers: {
      openai: { configured: openaiReady },
      tavily: { configured: tavilyReady },
    },
    synthesisMode: effectiveMode,
    model: effectiveMode === 'template' ? 'template' : getModel(),
    quickActions: [
      { id: 'market-trends', label: 'Market trends', prompt: 'What are the latest gold and silver jewelry market trends relevant to our business?' },
      { id: 'customer-demand', label: 'Customer demand', prompt: 'Analyze current customer demand patterns for precious metals and jewelry wholesale.' },
      { id: 'opportunities', label: 'New opportunities', prompt: 'What new market opportunities should LoopC pursue in Central Asia and the Middle East?' },
      { id: 'industry-growth', label: 'Industry growth', prompt: 'What is the industry growth outlook for gold jewelry manufacturing and distribution?' },
      { id: 'sales-strategy', label: 'Sales strategy', prompt: 'Suggest a sales strategy for the next quarter based on market conditions and our pipeline.' },
      { id: 'pipeline', label: 'Analyze our pipeline', prompt: 'Analyze our CRM pipeline and recommend priorities for closing deals.' },
    ],
  }
}

module.exports = {
  runSalesAiChat,
  getSalesAiConfig,
  getSynthesisMode,
  shouldPreferTemplate,
}
