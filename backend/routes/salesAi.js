const express = require('express')
const rateLimit = require('express-rate-limit')
const { protect } = require('../middleware/auth')
const { Joi, validateBody } = require('../middleware/validate')
const { isLocalDevEnv } = require('../utils/securityEnv')
const { assertSalesAiAccess, isSalesAiEnabledForTenant } = require('../services/salesAi/salesAiAccess')
const { runSalesAiChat, getSalesAiConfig } = require('../services/salesAi/salesAiOrchestrator')
const { buildSalesAiBriefing } = require('../services/salesAi/salesAiBriefing')
const { getConnectionStatus } = require('../services/email/emailInboxService')
const { resolveRequestTenantKey } = require('../config/tenants')

const router = express.Router()
router.use(protect)

const chatLimiter = rateLimit({
  windowMs: Number(process.env.SALES_AI_CHAT_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  max: Number(process.env.SALES_AI_CHAT_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isLocalDevEnv(),
  message: { success: false, message: 'Too many Sales AI requests. Please wait a moment.' },
})

const briefingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.SALES_AI_BRIEFING_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isLocalDevEnv(),
  message: { success: false, message: 'Too many briefing requests. Please wait a moment.' },
})

const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(4000).required(),
  history: Joi.array().items(Joi.object({
    role: Joi.string().valid('user', 'assistant').required(),
    content: Joi.string().max(8000).required(),
  })).max(12).optional(),
  pageContext: Joi.object({
    tab: Joi.string().max(80).allow('').optional(),
    path: Joi.string().max(200).allow('').optional(),
    tenant: Joi.string().max(40).allow('').optional(),
    region: Joi.string().max(40).allow('').optional(),
  }).optional(),
  chatInputs: Joi.object({
    region: Joi.string().max(40).allow('').optional(),
    constraints: Joi.string().max(500).allow('').optional(),
    depth: Joi.string().valid('deep', '').optional(),
  }).optional(),
})

router.get('/config', async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const config = getSalesAiConfig()
    const email = await getConnectionStatus(req.user, tenant)
    res.json({ success: true, tenant, ...config, email })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Sales AI unavailable' })
  }
})

router.get('/briefing', briefingLimiter, async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const briefing = await buildSalesAiBriefing(req.user)
    res.json({ success: true, ...briefing })
  } catch (err) {
    console.error('[sales-ai] briefing error:', err)
    const status = err.statusCode || 500
    res.status(status).json({
      success: false,
      message: err?.message || 'Sales Manager AI briefing could not be loaded.',
    })
  }
})

router.post('/chat', chatLimiter, validateBody(chatSchema), async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const result = await runSalesAiChat({
      user: req.user,
      message: req.body.message,
      history: req.body.history,
      pageContext: {
        ...req.body.pageContext,
        tenant: tenant || resolveRequestTenantKey(req),
      },
      chatInputs: req.body.chatInputs,
    })
    res.json({ success: true, ...result })
  } catch (err) {
    console.error('[sales-ai] chat error:', err)
    const status = err.statusCode || 500
    res.status(status).json({
      success: false,
      message: err?.message || 'Sales Manager AI could not complete your request.',
    })
  }
})

module.exports = router
module.exports.isSalesAiEnabledForTenant = isSalesAiEnabledForTenant
