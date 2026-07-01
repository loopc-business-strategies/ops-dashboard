const { buildSearchQueries } = require('./salesAiPrompts')
const { runTavilySearches, shouldUseAdvancedSearchDepth } = require('./tavilySearch')
const { buildCrmSnapshot } = require('./crmSnapshot')
const { buildMetalRatesSnapshot } = require('./metalRatesSnapshot')
const { runMarketResearchAgent } = require('./agents/marketResearchAgent')
const { runCrmInsightAgent } = require('./agents/crmInsightAgent')
const { runStrategyAgent, getModel } = require('./agents/strategyAgent')
const { runTemplateStrategyAgent, isOpenAiQuotaError } = require('./agents/templateStrategyAgent')
const { isOpenAiConfigured } = require('./openAiClient')

const REGION_OPTIONS = [
  { id: '', label: 'Global' },
  { id: 'uzbekistan', label: 'Uzbekistan / Central Asia' },
  { id: 'uae', label: 'UAE' },
  { id: 'gcc', label: 'GCC' },
  { id: 'turkey', label: 'Turkey' },
  { id: 'india', label: 'India' },
  { id: 'china', label: 'China' },
]

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

async function runSynthesis(ctx) {
  const {
    userMessage,
    marketSection,
    crmSection,
    crmSnapshot,
    metalRates,
    pageContext,
    history,
    chatInputs,
  } = ctx

  if (shouldPreferTemplate()) {
    return runTemplateStrategyAgent({
      userMessage,
      marketSection,
      crmSnapshot,
      metalRates,
      chatInputs,
      fallbackReason: isOpenAiConfigured() ? 'quota_or_policy' : 'disabled',
    })
  }

  try {
    return await runStrategyAgent({
      userMessage,
      marketSection,
      crmSection,
      metalRates,
      pageContext: { ...pageContext, chatInputs },
      history,
    })
  } catch (err) {
    if (getSynthesisMode() === 'auto' && isOpenAiQuotaError(err)) {
      return runTemplateStrategyAgent({
        userMessage,
        marketSection,
        crmSnapshot,
        metalRates,
        chatInputs,
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
  chatInputs = {},
}) {
  const userMessage = String(message || '').trim()
  if (!userMessage) {
    throw new Error('Message is required.')
  }

  const normalizedInputs = {
    region: String(chatInputs.region || pageContext.region || '').trim(),
    constraints: String(chatInputs.constraints || '').trim(),
    depth: String(chatInputs.depth || '').trim(),
  }

  const queries = buildSearchQueries(userMessage, normalizedInputs)
  const searchDepth = shouldUseAdvancedSearchDepth(userMessage, normalizedInputs) ? 'advanced' : 'basic'

  const [searchBatches, crmSnapshot, metalRates] = await Promise.all([
    runTavilySearches(queries, { searchDepth }),
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
    chatInputs: normalizedInputs,
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
      chatInputs: normalizedInputs,
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
    regions: REGION_OPTIONS,
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
  REGION_OPTIONS,
}
