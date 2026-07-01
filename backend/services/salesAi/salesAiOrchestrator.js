const { buildSearchQueries } = require('./salesAiPrompts')
const { runTavilySearches } = require('./tavilySearch')
const { buildCrmSnapshot } = require('./crmSnapshot')
const { buildErpCustomerSnapshot } = require('./erpCustomerSnapshot')
const { buildMetalRatesSnapshot } = require('./metalRatesSnapshot')
const { getBusinessProfile, formatBusinessProfileForPrompt } = require('./businessProfileService')
const { getPlaybooks } = require('./salesAiPlaybooks')
const { runMarketResearchAgent } = require('./agents/marketResearchAgent')
const { runCrmInsightAgent } = require('./agents/crmInsightAgent')
const { runErpInsightAgent } = require('./agents/erpInsightAgent')
const { runStrategyAgent, getModel } = require('./agents/strategyAgent')
const { runTemplateStrategyAgent, isOpenAiQuotaError } = require('./agents/templateStrategyAgent')
const { isOpenAiConfigured } = require('./openAiClient')
const { getAllowedTenants } = require('./salesAiAccess')

const REGION_OPTIONS = [
  { id: '', label: 'Global' },
  { id: 'uzbekistan', label: 'Uzbekistan / Central Asia' },
  { id: 'uae', label: 'UAE' },
  { id: 'gcc', label: 'GCC' },
  { id: 'turkey', label: 'Turkey' },
  { id: 'india', label: 'India' },
  { id: 'china', label: 'China' },
]

const HORIZON_OPTIONS = [
  { id: 'week', label: 'This week' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
]

const PRIORITY_OPTIONS = [
  { id: 'growth', label: 'Growth' },
  { id: 'margin', label: 'Margin' },
  { id: 'risk', label: 'Risk reduction' },
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

function buildDraftEmail(userMessage, crmSnapshot) {
  if (!/email|draft|write to|reach out/i.test(userMessage)) return null
  const deal = crmSnapshot?.detail?.topOpenDeals?.[0]
  const lead = crmSnapshot?.detail?.recentLeads?.[0]
  const subject = deal
    ? `Follow-up: ${deal.title}`
    : lead
      ? `Introduction — ${lead.companyName || lead.title}`
      : 'LoopC — precious metals partnership'
  const body = [
    'Dear [Name],',
    '',
    'I hope this message finds you well. Following recent market developments in precious metals, I wanted to connect regarding potential collaboration.',
    '',
    'LoopC supports wholesale jewelry and bullion partners with competitive pricing and reliable fulfillment.',
    '',
    'Would you be available for a brief call this week?',
    '',
    'Best regards,',
    '[Your name]',
  ].join('\n')
  return { subject, body }
}

async function runSynthesis(ctx) {
  const {
    userMessage,
    marketSection,
    crmSection,
    erpSection,
    businessProfileText,
    crmSnapshot,
    erpSnapshot,
    metalRates,
    pageContext,
    history,
  } = ctx

  if (shouldPreferTemplate()) {
    return runTemplateStrategyAgent({
      userMessage,
      marketSection,
      crmSnapshot,
      erpSnapshot,
      businessProfileText,
      metalRates,
      fallbackReason: isOpenAiConfigured() ? 'quota_or_policy' : 'disabled',
    })
  }

  try {
    return await runStrategyAgent({
      userMessage,
      marketSection,
      crmSection,
      erpSection,
      businessProfileText,
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
        erpSnapshot,
        businessProfileText,
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
  chatInputs = {},
}) {
  const userMessage = String(message || '').trim()
  if (!userMessage) {
    throw new Error('Message is required.')
  }

  const businessProfile = await getBusinessProfile()
  const profileText = formatBusinessProfileForPrompt(businessProfile)

  const searchOpts = {
    region: chatInputs.region || pageContext.region || businessProfile.targetRegions?.[0] || '',
    competitors: businessProfile.competitors || [],
  }

  const queries = buildSearchQueries(userMessage, searchOpts)
  const crmOpts = {
    dealId: chatInputs.dealId || pageContext.dealId,
  }

  const [searchBatches, crmSnapshot, erpSnapshot, metalRates] = await Promise.all([
    runTavilySearches(queries),
    buildCrmSnapshot(user, crmOpts),
    buildErpCustomerSnapshot(user),
    buildMetalRatesSnapshot(),
  ])

  const marketSection = runMarketResearchAgent(searchBatches)
  const crmSection = runCrmInsightAgent(crmSnapshot)
  const erpSection = runErpInsightAgent(erpSnapshot)

  const strategy = await runSynthesis({
    userMessage,
    marketSection,
    crmSection,
    erpSection,
    businessProfileText: profileText,
    crmSnapshot,
    erpSnapshot,
    metalRates,
    pageContext: { ...pageContext, chatInputs },
    history,
  })

  const sections = [
    { title: marketSection.title, agent: marketSection.agent, sources: marketSection.sources },
    { title: crmSection.title, agent: crmSection.agent },
    { title: erpSection.title, agent: erpSection.agent },
    { title: strategy.title, agent: strategy.agent },
    ...strategy.sections,
  ]

  const synthesisMode = strategy.meta?.synthesisMode
    || (strategy.meta?.model === 'template' ? 'template' : 'openai')

  const draftEmail = buildDraftEmail(userMessage, crmSnapshot)

  return {
    reply: strategy.reply,
    sections,
    meta: {
      tenant: user?.company || 'loopc',
      model: strategy.meta?.model || getModel(),
      synthesisMode,
      searchQueryCount: queries.length,
      crmAccessLevel: crmSnapshot?.accessLevel || 'none',
      erpAccessLevel: erpSnapshot?.accessLevel || 'none',
      draftEmail,
      chatInputs,
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
  const allowedTenants = getAllowedTenants()

  return {
    enabled: true,
    tenantScope: allowedTenants.join(','),
    providers: {
      openai: { configured: openaiReady },
      tavily: { configured: tavilyReady },
    },
    synthesisMode: effectiveMode,
    model: effectiveMode === 'template' ? 'template' : getModel(),
    regions: REGION_OPTIONS,
    horizons: HORIZON_OPTIONS,
    priorities: PRIORITY_OPTIONS,
    playbooks: getPlaybooks(),
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
