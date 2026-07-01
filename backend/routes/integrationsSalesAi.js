const express = require('express')
const { integrationProtect } = require('../middleware/integrationAuth')
const { normalizeTenant } = require('../config/tenants')
const { connectTenant } = require('../db/tenantConnections')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const User = require('../models/User')
const { buildCrmSnapshot } = require('../services/salesAi/crmSnapshot')
const { buildMetalRatesSnapshot } = require('../services/salesAi/metalRatesSnapshot')
const {
  fetchTenantInbox,
  getTenantConnectionStatus,
  isTenantSharedInboxEnabled,
} = require('../services/email/emailInboxService')
const { buildEmailAnalysis, formatEmailAnalysisSummary } = require('../services/salesAi/agents/emailAnalysis')

const router = express.Router()

async function runWithTenantContext(tenant, fn) {
  const connection = await connectTenant(tenant)
  registerAllOnConnection(connection)
  return runWithTenantConnection(connection, tenant, fn)
}

async function getIntegrationServiceUser(tenant) {
  const UserModel = await User.getTenantModel(tenant)
  const user = await UserModel.findOne({
    role: 'super_admin',
    isActive: true,
    isDeleted: false,
  }).lean()
  if (!user) {
    const err = new Error('No service user available for integration.')
    err.statusCode = 503
    throw err
  }
  return user
}

router.get('/health', integrationProtect, async (req, res) => {
  res.json({
    success: true,
    tenant: req.integrationTenant,
    service: 'loopc-sales-ai-connector',
  })
})

router.get('/crm-snapshot', integrationProtect, async (req, res) => {
  try {
    const tenant = normalizeTenant(req.integrationTenant)
    const snapshot = await runWithTenantContext(tenant, async () => {
      const user = await getIntegrationServiceUser(tenant)
      return buildCrmSnapshot(user)
    })
    res.json({ success: true, tenant, snapshot })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'CRM snapshot failed.' })
  }
})

router.get('/inbox-summary', integrationProtect, async (req, res) => {
  try {
    const tenant = normalizeTenant(req.integrationTenant)
    if (!isTenantSharedInboxEnabled(tenant)) {
      return res.status(400).json({
        success: false,
        message: 'Tenant shared inbox is not enabled.',
      })
    }

    const inbox = await runWithTenantContext(tenant, async () => {
      const status = await getTenantConnectionStatus(tenant, await getIntegrationServiceUser(tenant))
      if (!status.connected) {
        const err = new Error('Company inbox is not connected.')
        err.statusCode = 404
        throw err
      }
      return fetchTenantInbox(tenant, {
        query: 'newer_than:7d',
        maxResults: 20,
        userMessage: 'integration summary',
      })
    })

    const analysis = buildEmailAnalysis(inbox.messages || [], { query: inbox.query })
    const summary = formatEmailAnalysisSummary(analysis)

    res.json({
      success: true,
      tenant,
      inbox: {
        email: inbox.email,
        messageCount: (inbox.messages || []).length,
        summary,
        messages: (inbox.messages || []).slice(0, 10).map((m) => ({
          subject: m.subject,
          from: m.from,
          date: m.date,
          snippet: m.snippet,
        })),
      },
    })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Inbox summary failed.' })
  }
})

router.get('/metal-rates', integrationProtect, async (req, res) => {
  try {
    const tenant = normalizeTenant(req.integrationTenant)
    const metals = await runWithTenantContext(tenant, () => buildMetalRatesSnapshot())
    res.json({ success: true, tenant, metals })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Metal rates failed.' })
  }
})

module.exports = router
