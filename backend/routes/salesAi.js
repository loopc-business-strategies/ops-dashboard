const express = require('express')
const rateLimit = require('express-rate-limit')
const { protect, restrictTo } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const { isLocalDevEnv } = require('../utils/securityEnv')
const { assertSalesAiAccess, isSalesAiEnabledForTenant } = require('../services/salesAi/salesAiAccess')
const { runSalesAiChat, getSalesAiConfig } = require('../services/salesAi/salesAiOrchestrator')
const { getBusinessProfile, upsertBusinessProfile } = require('../services/salesAi/businessProfileService')
const { getPlaybooks, getPlaybookById } = require('../services/salesAi/salesAiPlaybooks')
const {
  listSessions,
  getSession,
  createSession,
  saveChatTurn,
  deleteSession,
  exportSessionMarkdown,
} = require('../services/salesAi/salesAiSessionService')
const { listTasks, createTask, runTask, AGENT_TYPES } = require('../services/salesAi/salesAiAgentTaskService')
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

const chatInputsSchema = Joi.object({
  region: Joi.string().max(40).allow('').optional(),
  horizon: Joi.string().valid('week', 'quarter', 'year', '').optional(),
  priority: Joi.string().valid('growth', 'margin', 'risk', '').optional(),
  constraints: Joi.string().max(500).allow('').optional(),
  customerId: Joi.string().max(80).allow('').optional(),
  dealId: Joi.string().max(80).allow('').optional(),
})

const pageContextSchema = Joi.object({
  tab: Joi.string().max(80).allow('').optional(),
  path: Joi.string().max(200).allow('').optional(),
  tenant: Joi.string().max(40).allow('').optional(),
  erpSubTab: Joi.string().max(80).allow('').optional(),
  customerId: Joi.string().max(80).allow('').optional(),
  dealId: Joi.string().max(80).allow('').optional(),
  region: Joi.string().max(40).allow('').optional(),
})

const chatSchema = Joi.object({
  message: Joi.string().trim().max(4000).allow('').optional(),
  history: Joi.array().items(Joi.object({
    role: Joi.string().valid('user', 'assistant').required(),
    content: Joi.string().max(8000).required(),
  })).max(12).optional(),
  pageContext: pageContextSchema.optional(),
  chatInputs: chatInputsSchema.optional(),
  sessionId: Joi.string().max(80).allow('').optional(),
  playbookId: Joi.string().max(40).allow('').optional(),
  saveSession: Joi.boolean().optional(),
}).custom((value, helpers) => {
  const hasMessage = String(value.message || '').trim().length > 0
  const hasPlaybook = Boolean(value.playbookId)
  if (!hasMessage && !hasPlaybook) {
    return helpers.error('any.custom', { message: 'message or playbookId is required' })
  }
  return value
})

const profileSchema = Joi.object({
  targetRegions: Joi.array().items(Joi.string().max(80)).max(20).optional(),
  productFocus: Joi.string().max(2000).allow('').optional(),
  icpDescription: Joi.string().max(2000).allow('').optional(),
  quarterlyGoals: Joi.string().max(2000).allow('').optional(),
  competitors: Joi.array().items(Joi.string().max(120)).max(20).optional(),
  riskAppetite: Joi.string().valid('conservative', 'balanced', 'aggressive', '').optional(),
})

const sessionCreateSchema = Joi.object({
  title: Joi.string().max(120).allow('').optional(),
  messages: Joi.array().items(Joi.object({
    role: Joi.string().valid('user', 'assistant').required(),
    content: Joi.string().max(16000).required(),
  })).max(50).optional(),
})

const taskCreateSchema = Joi.object({
  agent: Joi.string().valid(...AGENT_TYPES).required(),
  prompt: Joi.string().trim().min(1).max(4000).required(),
  assignedTo: Joi.string().max(120).allow('').optional(),
  assignedToId: Joi.string().max(80).allow('').optional(),
  pageContext: pageContextSchema.optional(),
})

const idParamSchema = Joi.object({
  id: Joi.string().required(),
})

router.get('/config', (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const config = getSalesAiConfig()
    res.json({ success: true, tenant, ...config })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Sales AI unavailable' })
  }
})

router.get('/playbooks', (req, res) => {
  try {
    assertSalesAiAccess(req)
    res.json({ success: true, playbooks: getPlaybooks() })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.get('/profile', async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const profile = await getBusinessProfile()
    res.json({ success: true, profile })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.put('/profile', restrictTo('super_admin', 'management'), validateBody(profileSchema), async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const profile = await upsertBusinessProfile(req.body, req.user)
    res.json({ success: true, profile })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.get('/sessions', async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const sessions = await listSessions(req.user._id)
    res.json({ success: true, sessions })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.post('/sessions', validateBody(sessionCreateSchema), async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const session = await createSession(req.user, req.body)
    res.status(201).json({ success: true, session })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.get('/sessions/:id', validateParams(idParamSchema), async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const session = await getSession(req.user._id, req.params.id)
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' })
    }
    return res.json({ success: true, session })
  } catch (err) {
    const status = err.statusCode || 500
    return res.status(status).json({ success: false, message: err.message })
  }
})

router.get('/sessions/:id/export', validateParams(idParamSchema), async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const session = await getSession(req.user._id, req.params.id)
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' })
    }
    const markdown = exportSessionMarkdown(session)
    const filename = `${(session.title || 'briefing').replace(/[^\w-]+/g, '-').slice(0, 40)}.md`
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.send(markdown)
  } catch (err) {
    const status = err.statusCode || 500
    return res.status(status).json({ success: false, message: err.message })
  }
})

router.delete('/sessions/:id', validateParams(idParamSchema), async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const ok = await deleteSession(req.user._id, req.params.id)
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Session not found.' })
    }
    return res.json({ success: true })
  } catch (err) {
    const status = err.statusCode || 500
    return res.status(status).json({ success: false, message: err.message })
  }
})

router.get('/tasks', async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const tasks = await listTasks(req.user, { status: req.query.status })
    res.json({ success: true, tasks, agentTypes: AGENT_TYPES })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.post('/tasks', validateBody(taskCreateSchema), async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const task = await createTask(req.user, req.body)
    res.status(201).json({ success: true, task })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.post('/tasks/:id/run', validateParams(idParamSchema), async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const { task, result } = await runTask(req.user, req.params.id)
    res.json({ success: true, task, reply: result.reply, sections: result.sections, meta: result.meta })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message })
  }
})

router.post('/chat', chatLimiter, validateBody(chatSchema), async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const playbook = req.body.playbookId ? getPlaybookById(req.body.playbookId) : null
    const userMessage = String(req.body.message || '').trim() || playbook?.label || 'Briefing'
    const message = playbook?.prompt || userMessage
    const pageContext = {
      ...req.body.pageContext,
      tenant: tenant || resolveRequestTenantKey(req),
    }
    const chatInputs = req.body.chatInputs || {}

    const result = await runSalesAiChat({
      user: req.user,
      message,
      history: req.body.history,
      pageContext,
      chatInputs,
    })

    let session = null
    if (req.body.saveSession !== false) {
      session = await saveChatTurn(req.user, {
        sessionId: req.body.sessionId,
        userMessage: userMessage,
        assistantReply: result.reply,
        meta: result.meta,
      })
    }

    res.json({
      success: true,
      ...result,
      session,
      playbook: playbook ? { id: playbook.id, label: playbook.label } : null,
    })
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
