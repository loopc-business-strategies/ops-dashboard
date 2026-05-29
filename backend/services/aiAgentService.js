const fs = require('fs')
const path = require('path')
const Task = require('../models/Task')
const { runBuiltinAgent } = require('./builtinAgentService')

const BUILTIN_PROVIDER = 'builtin'
const OPENAI_PROVIDER = 'openai'

const OPENAI_CHAT_MODELS = [
  { id: 'gpt-4o', label: 'ChatGPT 4o', description: 'Best quality' },
  { id: 'gpt-4o-mini', label: 'ChatGPT 4o mini', description: 'Faster, lower cost' },
]

const OPENAI_MODEL_IDS = new Set(OPENAI_CHAT_MODELS.map((m) => m.id))

function isOpenAiConfigured() {
  return Boolean(String(process.env.OPENAI_API_KEY || '').trim())
}

function resolveProvider(requested) {
  const preferred = String(requested || process.env.AI_PROVIDER || BUILTIN_PROVIDER).trim().toLowerCase()
  if (preferred === OPENAI_PROVIDER && isOpenAiConfigured()) return OPENAI_PROVIDER
  return BUILTIN_PROVIDER
}

function resolveOpenAiModel(requested) {
  const model = String(requested || process.env.AI_MODEL || 'gpt-4o').trim()
  return OPENAI_MODEL_IDS.has(model) ? model : 'gpt-4o'
}

function getAiAgentConfig() {
  const openaiReady = isOpenAiConfigured()
  return {
    provider: BUILTIN_PROVIDER,
    providerLabel: 'Ops Agent',
    configured: true,
    providers: [
      {
        id: BUILTIN_PROVIDER,
        label: 'Ops Agent',
        description: 'Built-in — live data, FAQs, fix with prompt',
        available: true,
        default: true,
      },
      {
        id: OPENAI_PROVIDER,
        label: 'ChatGPT',
        description: openaiReady ? 'OpenAI GPT models' : 'Add OPENAI_API_KEY on Railway to enable',
        available: openaiReady,
        default: false,
      },
    ],
    openai: {
      configured: openaiReady,
      defaultModel: resolveOpenAiModel(process.env.AI_MODEL),
      models: OPENAI_CHAT_MODELS,
    },
  }
}

const PRODUCT_KNOWLEDGE = `
Ops Dashboard — multi-tenant ERP (MG, CG, Loopc).
Modules: Overview, ERP (ledger, vouchers, inventory, vendors, reports), Finance, HR, CRM, Operations, Production, Compliance, Training.
Live metals: MT4 bridge → api.loopcstrategies.com → top bar USD/OZ.
`.trim()

async function gatherLiveMetalContext(req) {
  try {
    const base = String(process.env.SERVER_BASE_URL || '').replace(/\/$/, '')
    if (!base) return null
    const headers = {
      cookie: req.headers.cookie || '',
      authorization: req.headers.authorization || '',
      'x-tenant': req.headers['x-tenant'] || req.headers['x-company'] || req.user?.tenant || '',
    }
    const liveRes = await fetch(`${base}/api/erp-accounting/metal-rates/live`, { headers })
    if (!liveRes.ok) return { error: `metal-rates/live HTTP ${liveRes.status}` }
    const live = await liveRes.json()
    const rates = live?.rates || {}
    return {
      live: Boolean(live?.live),
      feedType: live?.feedType || rates?.source || '',
      gold: Number(rates?.sourceGoldPrice || rates?.goldPrice || 0),
      silver: Number(rates?.sourceSilverPrice || rates?.silverPrice || 0),
      platinum: Number(rates?.sourcePlatinumPrice || rates?.platinumPrice || 0),
      unit: rates?.sourceUnit || 'TOZ',
      currency: rates?.priceCurrency || 'USD',
      updatedAt: rates?.updatedAt || null,
      message: live?.message || '',
    }
  } catch (err) {
    return { error: err?.message || 'Could not load metal rates' }
  }
}

async function gatherTaskSummary(user) {
  try {
    const filter = { isDeleted: { $ne: true } }
    const [open, overdue] = await Promise.all([
      Task.countDocuments({ ...filter, status: { $nin: ['done', 'cancelled'] } }),
      Task.countDocuments({
        ...filter,
        status: { $nin: ['done', 'cancelled'] },
        dueDate: { $lt: new Date() },
      }),
    ])
    return { openTasks: open, overdueTasks: overdue, user: user?.name || 'User' }
  } catch {
    return { openTasks: null, overdueTasks: null }
  }
}

function readBuildMeta() {
  try {
    const metaPath = path.join(__dirname, '..', 'build-meta.json')
    return JSON.parse(fs.readFileSync(metaPath, 'utf8'))
  } catch {
    return {}
  }
}

async function callOpenAIChat({ systemPrompt, history, message, model: requestedModel }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) return null

  const model = resolveOpenAiModel(requestedModel)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 1200,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const reply = String(data?.choices?.[0]?.message?.content || '').trim()
  return { reply, model }
}

async function runAgentChat({
  req,
  message,
  history = [],
  pageContext = {},
  lastError = null,
  model = null,
  provider = null,
}) {
  const tenant = String(req.headers['x-tenant'] || req.headers['x-company'] || req.user?.tenant || 'loopc').toLowerCase()
  const selectedProvider = resolveProvider(provider)

  const [metals, tasks] = await Promise.all([
    gatherLiveMetalContext(req),
    gatherTaskSummary(req.user),
  ])

  const context = {
    user: req.user,
    tenant,
    metals,
    tasks,
    build: readBuildMeta(),
    lastError,
    pageContext,
  }

  if (selectedProvider === OPENAI_PROVIDER) {
    const systemPrompt = [
      'You are the Ops Dashboard AI Agent.',
      'Be concise and actionable. Use CONTEXT JSON for live numbers.',
      PRODUCT_KNOWLEDGE,
      `CONTEXT:\n${JSON.stringify(context, null, 2)}`,
    ].join('\n')

    try {
      const llmResult = await callOpenAIChat({
        systemPrompt,
        history,
        message,
        model: resolveOpenAiModel(model),
      })
      if (llmResult?.reply) {
        return {
          reply: llmResult.reply,
          intent: 'openai',
          mode: OPENAI_PROVIDER,
          provider: OPENAI_PROVIDER,
          providerLabel: 'ChatGPT',
          model: llmResult.model,
          contextUsed: { tenant, provider: OPENAI_PROVIDER, hasMetals: Boolean(metals && !metals.error), hasError: Boolean(lastError) },
        }
      }
    } catch (err) {
      console.warn('[ai-agent] OpenAI failed, using built-in agent:', err?.message || err)
    }
  }

  const builtin = runBuiltinAgent({ message, context })
  return {
    reply: builtin.reply,
    intent: builtin.intent,
    mode: BUILTIN_PROVIDER,
    provider: BUILTIN_PROVIDER,
    providerLabel: 'Ops Agent',
    model: null,
    contextUsed: {
      tenant,
      provider: BUILTIN_PROVIDER,
      hasMetals: Boolean(metals && !metals.error),
      hasError: Boolean(lastError),
    },
  }
}

/** @deprecated use detectBuiltinIntent from builtinAgentService */
function detectIntent(message) {
  const { detectBuiltinIntent } = require('./builtinAgentService')
  return detectBuiltinIntent(message)
}

module.exports = {
  runAgentChat,
  getAiAgentConfig,
  resolveOpenAiModel,
  resolveProvider,
  detectIntent,
  PRODUCT_KNOWLEDGE,
  OPENAI_CHAT_MODELS,
  BUILTIN_PROVIDER,
  OPENAI_PROVIDER,
}
