const express = require('express')
const { protect } = require('../middleware/auth')
const { Joi, validateBody } = require('../middleware/validate')
const { assertSalesAiAccess } = require('../services/salesAi/salesAiAccess')
const { getAutomationSummary, listAutomationLog } = require('../services/salesAi/salesAiAutomationLog')
const { listPendingProposals, resolveProposal, buildMailtoUrl } = require('../services/salesAi/agent/actionProposals')
const { setTenantAutoEnabled, getAutomationConfig, loadTenantAutoSettings } = require('../services/salesAi/salesAiConfig')

const router = express.Router()
router.use(protect)

const settingsSchema = Joi.object({
  autoEnabled: Joi.boolean().required(),
})

router.get('/automation', async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    await loadTenantAutoSettings(tenant)
    const [summary, proposals] = await Promise.all([
      getAutomationSummary(tenant),
      listPendingProposals(tenant, 10),
    ])
    res.json({
      success: true,
      tenant,
      automation: summary,
      proposals: proposals.map((p) => ({
        id: String(p._id),
        actionType: p.actionType,
        title: p.title,
        summary: p.summary,
        payload: p.actionType === 'email_reply_draft' ? { ...p.payload, mailtoUrl: buildMailtoUrl(p) } : p.payload,
        createdAt: p.createdAt,
      })),
      config: getAutomationConfig(tenant),
    })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Automation unavailable' })
  }
})

router.get('/automation/log', async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const rows = await listAutomationLog(tenant, { limit })
    res.json({ success: true, data: rows })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Log unavailable' })
  }
})

router.post('/proposals/:id/approve', async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const doc = await resolveProposal(tenant, req.params.id, req.user._id, 'approve')
    if (!doc) return res.status(404).json({ success: false, message: 'Proposal not found or already resolved.' })

    const payload = doc.actionType === 'email_reply_draft'
      ? { ...doc.payload, mailtoUrl: buildMailtoUrl(doc) }
      : doc.payload

    res.json({
      success: true,
      proposal: {
        id: String(doc._id),
        actionType: doc.actionType,
        title: doc.title,
        status: doc.status,
        payload,
      },
      message: doc.actionType === 'email_reply_draft'
        ? 'Draft approved — use mailto link to send from your mail client.'
        : 'Action approved.',
    })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Approve failed' })
  }
})

router.post('/proposals/:id/dismiss', async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const doc = await resolveProposal(tenant, req.params.id, req.user._id, 'dismiss')
    if (!doc) return res.status(404).json({ success: false, message: 'Proposal not found or already resolved.' })
    res.json({ success: true, message: 'Proposal dismissed.' })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Dismiss failed' })
  }
})

router.patch('/settings', validateBody(settingsSchema), async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    if (req.user?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin required to change automation settings.' })
    }
    const autoEnabled = await setTenantAutoEnabled(tenant, req.body.autoEnabled, req.user._id)
    res.json({ success: true, tenant, autoEnabled, config: getAutomationConfig(tenant) })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Settings update failed' })
  }
})

module.exports = router
