const fs = require('fs')
const path = require('path')
const { runBuiltinAgent } = require('./builtinAgentService')
const { gatherLoopcSnapshot } = require('./loopcContextService')
const { getProjectBrainSummary } = require('./loopcProjectBrain')

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

function parseOpenAiErrorBody(raw) {
  const text = String(raw || '')
  const jsonStart = text.indexOf('{')
  if (jsonStart < 0) return null
  try {
    return JSON.parse(text.slice(jsonStart))
  } catch {
    return null
  }
}

function formatOpenAiUserMessage(err) {
  const raw = String(err?.message || err || '')
  const parsed = parseOpenAiErrorBody(raw)
  const code = String(parsed?.error?.code || parsed?.error?.type || '').toLowerCase()
  const msg = String(parsed?.error?.message || raw)

  if (code === 'insufficient_quota' || /quota|billing details/i.test(msg)) {
    return [
      'ChatGPT could not respond — your OpenAI API account has **no billing quota**.',
      '',
      '1. Open [platform.openai.com/account/billing](https://platform.openai.com/account/billing)',
      '2. Add a payment method and a small usage limit (e.g. $5/month)',
      '3. Try ChatGPT again here',
      '',
      'Until then, switch Engine to **LoopC (built-in)** — it is free and uses live dashboard data.',
    ].join('\n')
  }
  if (code === 'invalid_api_key' || /401|invalid.*api.*key|authentication/i.test(raw)) {
    return 'ChatGPT could not respond — the **OPENAI_API_KEY** on the server is invalid. Ask your admin to check the key on Railway.'
  }
  if (/429/.test(raw) && !/quota|billing/i.test(msg)) {
    return 'ChatGPT is rate-limited right now. Wait a minute and try again, or use **LoopC (built-in)**.'
  }
  return `ChatGPT could not respond: ${msg.slice(0, 220)}\n\nTry **LoopC (built-in)** instead.`
}

function getAiAgentConfig() {
  const openaiReady = isOpenAiConfigured()
  return {
    provider: BUILTIN_PROVIDER,
    providerLabel: 'LoopC',
    configured: true,
    providers: [
      {
        id: BUILTIN_PROVIDER,
        label: 'LoopC',
        description: 'LoopC Pro — live data, project code brain, auto-fix recipes, ERP/CRM help',
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
    projectBrain: getProjectBrainSummary(),
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

async function _gatherTaskSummary(_user) {
  try {
    const { gatherTaskSnapshot } = require('./loopcContextService')
    return gatherTaskSnapshot()
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

async function callOpenAIChat({ systemPrompt, history, message, model: requestedModel, attachments = [] }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) return null

  const model = resolveOpenAiModel(requestedModel)
  const attachmentNotes = []
  const userContent = [{ type: 'text', text: message }]

  for (const file of attachments) {
    if (file.kind === 'image' && file.imageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${file.mimeType};base64,${file.imageBase64}` },
      })
      attachmentNotes.push(`Image: ${file.name}`)
    } else if (file.kind === 'audio' && file.audioBase64) {
      const transcript = await transcribeOpenAIAudio({
        apiKey,
        base64: file.audioBase64,
        mimeType: file.mimeType,
        filename: file.name,
      })
      if (transcript) {
        attachmentNotes.push(`Audio transcript (${file.name}):\n${transcript}`)
      } else {
        attachmentNotes.push(`Audio: ${file.name} (transcription unavailable)`)
      }
    } else if (file.textExcerpt) {
      attachmentNotes.push(`File ${file.name}:\n${file.textExcerpt}`)
    } else {
      attachmentNotes.push(`Attachment: ${file.name} (${file.kind}, ${file.summary || ''})`)
    }
  }

  const enrichedSystem = attachmentNotes.length
    ? `${systemPrompt}\n\nUPLOADED FILES:\n${attachmentNotes.join('\n\n---\n\n')}`
    : systemPrompt

  const messages = [
    { role: 'system', content: enrichedSystem },
    ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent.length > 1 ? userContent : message },
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
      max_tokens: 1600,
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

async function transcribeOpenAIAudio({ apiKey, base64, mimeType, filename }) {
  try {
    const buffer = Buffer.from(base64, 'base64')
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mimeType || 'audio/webm' }), filename || 'audio.webm')
    form.append('model', 'whisper-1')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    if (!res.ok) return null
    const data = await res.json()
    return String(data?.text || '').trim()
  } catch {
    return null
  }
}

async function runAgentChat({
  req,
  message,
  history = [],
  pageContext = {},
  lastError = null,
  model = null,
  provider = null,
  attachments = [],
}) {
  const tenant = String(req.headers['x-tenant'] || req.headers['x-company'] || req.user?.tenant || 'loopc').toLowerCase()
  const selectedProvider = resolveProvider(provider)

  const build = readBuildMeta()
  const metals = await gatherLiveMetalContext(req)
  const snapshot = await gatherLoopcSnapshot({
    user: req.user,
    tenant,
    metals,
    build,
    pageContext,
    lastError,
  })

  const context = {
    user: req.user,
    tenant,
    metals,
    tasks: snapshot.tasks,
    snapshot,
    build,
    lastError,
    pageContext,
    attachments,
  }

  if (selectedProvider === OPENAI_PROVIDER) {
    const systemPrompt = [
      'You are the LoopC AI agent embedded in the Ops Dashboard.',
      'Be concise and actionable. Use CONTEXT JSON for live numbers.',
      attachments.length ? 'The user uploaded file(s). Analyze them and answer their question.' : '',
      PRODUCT_KNOWLEDGE,
      `CONTEXT:\n${JSON.stringify({ ...context, attachments: attachments.map((a) => ({ name: a.name, kind: a.kind, summary: a.summary })) }, null, 2)}`,
    ].filter(Boolean).join('\n')

    try {
      const llmResult = await callOpenAIChat({
        systemPrompt,
        history,
        message,
        model: resolveOpenAiModel(model),
        attachments,
      })
      if (llmResult?.reply) {
        return {
          reply: llmResult.reply,
          intent: 'openai',
          mode: OPENAI_PROVIDER,
          provider: OPENAI_PROVIDER,
          providerLabel: 'ChatGPT',
          model: llmResult.model,
          contextUsed: { tenant, provider: OPENAI_PROVIDER, hasMetals: Boolean(metals && !metals.error), hasError: Boolean(lastError), attachmentCount: attachments.length },
        }
      }
    } catch (err) {
      console.warn('[ai-agent] OpenAI failed:', err?.message || err)
      return {
        reply: formatOpenAiUserMessage(err),
        intent: 'openai_error',
        mode: OPENAI_PROVIDER,
        provider: OPENAI_PROVIDER,
        providerLabel: 'ChatGPT',
        model: resolveOpenAiModel(model),
        error: true,
        contextUsed: {
          tenant,
          provider: OPENAI_PROVIDER,
          hasMetals: Boolean(metals && !metals.error),
          hasError: Boolean(lastError),
        },
      }
    }
  }

  const builtin = runBuiltinAgent({ message, context, history })
  return {
    reply: builtin.reply,
    intent: builtin.intent,
    mode: BUILTIN_PROVIDER,
    provider: BUILTIN_PROVIDER,
    providerLabel: 'LoopC',
    model: null,
    contextUsed: {
      tenant,
      provider: BUILTIN_PROVIDER,
      hasMetals: Boolean(metals && !metals.error),
      hasError: Boolean(lastError),
      hasSnapshot: Boolean(snapshot),
      attachmentCount: attachments.length,
    },
  }
}

module.exports = {
  runAgentChat,
  getAiAgentConfig,
  resolveOpenAiModel,
  resolveProvider,
  formatOpenAiUserMessage,
  PRODUCT_KNOWLEDGE,
  OPENAI_CHAT_MODELS,
  BUILTIN_PROVIDER,
  OPENAI_PROVIDER,
}
