const { buildSearchQueries, classifyEmailIntent } = require('./salesAiPrompts')
const { runTavilySearches, shouldUseAdvancedSearchDepth } = require('./tavilySearch')
const { buildCrmSnapshot } = require('./crmSnapshot')
const { buildMetalRatesSnapshot } = require('./metalRatesSnapshot')
const { runMarketResearchAgent } = require('./agents/marketResearchAgent')
const { runCrmInsightAgent } = require('./agents/crmInsightAgent')
const { runEmailInboxAgent } = require('./agents/emailInboxAgent')
const { runStrategyAgent, getModel } = require('./agents/strategyAgent')
const { runTemplateStrategyAgent, isOpenAiQuotaError } = require('./agents/templateStrategyAgent')
const { isOpenAiConfigured } = require('./openAiClient')
const { getGmailConnectStartUrl } = require('../email/emailInboxService')

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

function shouldSkipTavilyForMessage(userMessage) {
  const wantsEmail = classifyEmailIntent(userMessage)
  if (!wantsEmail) return false
  const hasNonEmailTopic = /market|trend|pipeline|crm|deal|lead|opportunit|gold price|silver price/i.test(userMessage)
  return !hasNonEmailTopic
}

async function runSynthesis(ctx) {
  const {
    userMessage,
    marketSection,
    crmSection,
    crmSnapshot,
    metalRates,
    emailSection,
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
      emailSection,
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
      emailSection,
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
        emailSection,
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

  const wantsEmail = classifyEmailIntent(userMessage)
  const skipTavily = shouldSkipTavilyForMessage(userMessage)
  const queries = skipTavily ? [] : buildSearchQueries(userMessage, normalizedInputs)
  const searchDepth = shouldUseAdvancedSearchDepth(userMessage, normalizedInputs) ? 'advanced' : 'basic'

  const emailPromise = wantsEmail ? runEmailInboxAgent(user, userMessage) : Promise.resolve(null)
  const searchPromise = skipTavily ? Promise.resolve([]) : runTavilySearches(queries, { searchDepth })

  const [searchBatches, crmSnapshot, metalRates, emailSection] = await Promise.all([
    searchPromise,
    buildCrmSnapshot(user),
    buildMetalRatesSnapshot(),
    emailPromise,
  ])

  if (emailSection?.connectRequired) {
    const connectUrl = emailSection.connectUrl || getGmailConnectStartUrl()
    return {
      reply: [
        '_Gmail is not connected._',
        '',
        '## Answer',
        'I can check your inbox once you connect Gmail (read-only access). Click **Connect Gmail** in the widget, complete Google sign-in, then ask again.',
        '',
        `Connect: ${connectUrl}`,
      ].join('\n'),
      sections: [{ title: 'Inbox', agent: 'emailInbox' }],
      meta: {
        tenant: user?.company || 'loopc',
        model: 'template',
        synthesisMode: 'template',
        emailConnectRequired: true,
        emailConnectUrl: connectUrl,
        crmAccessLevel: crmSnapshot?.accessLevel || 'none',
      },
    }
  }

  const marketSection = runMarketResearchAgent(searchBatches)
  const crmSection = runCrmInsightAgent(crmSnapshot)

  const strategy = await runSynthesis({
    userMessage,
    marketSection,
    crmSection,
    crmSnapshot,
    metalRates,
    emailSection,
    pageContext,
    history,
    chatInputs: normalizedInputs,
  })

  const sections = [
    ...(emailSection ? [{ title: emailSection.title, agent: emailSection.agent }] : []),
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
      emailChecked: Boolean(emailSection && !emailSection.connectRequired),
      emailMessageCount: emailSection?.messages?.length || 0,
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
      { id: 'check-email', label: 'Check email', prompt: 'Check my email for important sales-related messages from the last 24 hours.' },
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
