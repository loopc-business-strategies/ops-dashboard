const express = require('express')
const rateLimit = require('express-rate-limit')
const { protect } = require('../middleware/auth')
const { Joi, validateBody } = require('../middleware/validate')
const { runAgentChat, getAiAgentConfig } = require('../services/aiAgentService')

const router = express.Router()

const isProduction = process.env.NODE_ENV === 'production'
const aiChatLimiter = rateLimit({
  windowMs: Number(process.env.AI_CHAT_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.AI_CHAT_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { success: false, message: 'Too many AI requests. Please wait a moment.' },
})

const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(4000).required(),
  history: Joi.array().items(Joi.object({
    role: Joi.string().valid('user', 'assistant').required(),
    content: Joi.string().max(8000).required(),
  })).max(20).optional(),
  pageContext: Joi.object({
    tab: Joi.string().max(80).allow('').optional(),
    path: Joi.string().max(200).allow('').optional(),
    tenant: Joi.string().max(40).allow('').optional(),
  }).optional(),
  lastError: Joi.object({
    status: Joi.number().integer().min(0).max(599).allow(null).optional(),
    message: Joi.string().max(500).allow('').optional(),
    url: Joi.string().max(500).allow('').optional(),
    method: Joi.string().max(10).allow('').optional(),
    at: Joi.string().max(40).allow('').optional(),
  }).allow(null).optional(),
  model: Joi.string().valid('gpt-4o', 'gpt-4o-mini').optional(),
  provider: Joi.string().valid('builtin', 'openai').optional(),
})

router.get('/config', protect, (req, res) => {
  res.json({ success: true, ...getAiAgentConfig() })
})

router.post('/chat', protect, aiChatLimiter, validateBody(chatSchema), async (req, res) => {
  try {
    const { message, history = [], pageContext = {}, lastError = null, model = null, provider = null } = req.body
    const result = await runAgentChat({
      req,
      message,
      history,
      pageContext,
      lastError,
      model,
      provider,
    })

    res.json({
      success: true,
      reply: result.reply,
      intent: result.intent,
      mode: result.mode,
      provider: result.provider,
      providerLabel: result.providerLabel,
      model: result.model,
      contextUsed: result.contextUsed,
    })
  } catch (err) {
    console.error('[ai-agent] chat error:', err)
    res.status(500).json({ success: false, message: 'AI agent could not process your request.' })
  }
})

module.exports = router
