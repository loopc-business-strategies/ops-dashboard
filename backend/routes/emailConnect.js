const express = require('express')
const { protect } = require('../middleware/auth')
const { assertSalesAiAccess } = require('../services/salesAi/salesAiAccess')
const { normalizeTenant } = require('../config/tenants')
const { connectTenant } = require('../db/tenantConnections')
const { registerAllOnConnection } = require('../db/tenantModelRegistry')
const { runWithTenantConnection } = require('../db/tenantModelProxy')
const User = require('../models/User')
const {
  buildOAuthState,
  parseOAuthState,
  buildGmailAuthUrl,
  exchangeGmailCode,
  getConnectionStatus,
  getTenantConnectionStatus,
  saveGmailConnection,
  saveTenantGmailConnection,
  disconnectEmail,
  disconnectTenantEmail,
  getFrontendRedirectUrl,
  getTenantRedirectUri,
  isGmailConfigured,
} = require('../services/email/emailInboxService')
const { isTokenEncryptionConfigured } = require('../utils/tokenEncryption')

const router = express.Router()

function assertSuperAdmin(req) {
  if (req.user?.role !== 'super_admin') {
    const err = new Error('Only super admins can manage the company inbox.')
    err.statusCode = 403
    throw err
  }
}

router.get('/connection', protect, async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const status = await getConnectionStatus(req.user, tenant)
    res.json({ success: true, ...status })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Could not load email connection.' })
  }
})

router.get('/tenant-connection', protect, async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    const status = await getTenantConnectionStatus(tenant, req.user)
    res.json({ success: true, ...status })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Could not load tenant email connection.' })
  }
})

router.delete('/connection', protect, async (req, res) => {
  try {
    assertSalesAiAccess(req)
    await disconnectEmail(req.user, String(req.query.provider || 'gmail'))
    res.json({ success: true })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Could not disconnect email.' })
  }
})

router.delete('/tenant-connection', protect, async (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    assertSuperAdmin(req)
    await runWithTenantContext(tenant, async () => {
      await disconnectTenantEmail(String(req.query.provider || 'gmail'))
    })
    res.json({ success: true })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Could not disconnect company inbox.' })
  }
})

async function runWithTenantContext(tenant, fn) {
  const connection = await connectTenant(tenant)
  registerAllOnConnection(connection)
  return runWithTenantConnection(connection, tenant, fn)
}

router.get('/oauth/gmail/start', protect, (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    if (!isGmailConfigured() || !isTokenEncryptionConfigured()) {
      return res.status(503).json({ success: false, message: 'Gmail integration is not configured on the server.' })
    }
    const state = buildOAuthState(req.user._id, tenant, 'user')
    return res.redirect(buildGmailAuthUrl(state))
  } catch (err) {
    const status = err.statusCode || 500
    return res.status(status).json({ success: false, message: err.message || 'Could not start Gmail OAuth.' })
  }
})

router.get('/oauth/gmail/tenant/start', protect, (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    assertSuperAdmin(req)
    if (!isGmailConfigured() || !isTokenEncryptionConfigured()) {
      return res.status(503).json({ success: false, message: 'Gmail integration is not configured on the server.' })
    }
    const state = buildOAuthState(req.user._id, tenant, 'tenant')
    return res.redirect(buildGmailAuthUrl(state, getTenantRedirectUri()))
  } catch (err) {
    const status = err.statusCode || 500
    return res.status(status).json({ success: false, message: err.message || 'Could not start company Gmail OAuth.' })
  }
})

async function handleGmailCallback(req, res, { scope, redirectUri, saveFn }) {
  const code = String(req.query.code || '')
  const state = String(req.query.state || '')
  if (!code || !state) {
    return res.redirect(getFrontendRedirectUrl('loopc', 'salesAiEmail=error&reason=missing_code'))
  }

  const payload = parseOAuthState(state)
  if (payload.scope !== scope) {
    return res.redirect(getFrontendRedirectUrl(payload.tenant || 'loopc', 'salesAiEmail=error&reason=invalid_scope'))
  }

  const tenant = normalizeTenant(payload.tenant || 'loopc')
  return runWithTenantContext(tenant, async () => {
    const UserModel = await User.getTenantModel(tenant)
    const user = await UserModel.findById(payload.userId)
    if (!user) {
      res.redirect(getFrontendRedirectUrl(tenant, 'salesAiEmail=error&reason=user_not_found'))
      return
    }
    const tokens = await exchangeGmailCode(code, redirectUri)
    await saveFn(user, tokens, tenant)
    res.redirect(getFrontendRedirectUrl(tenant, 'salesAiEmail=connected'))
  })
}

router.get('/oauth/gmail/callback', async (req, res) => {
  try {
    await handleGmailCallback(req, res, {
      scope: 'user',
      redirectUri: undefined,
      saveFn: (user, tokens) => saveGmailConnection(user, tokens),
    })
  } catch (err) {
    console.error('[email] gmail callback error:', err)
    return res.redirect(getFrontendRedirectUrl('loopc', 'salesAiEmail=error'))
  }
})

router.get('/oauth/gmail/tenant/callback', async (req, res) => {
  try {
    await handleGmailCallback(req, res, {
      scope: 'tenant',
      redirectUri: getTenantRedirectUri(),
      saveFn: (user, tokens, tenant) => saveTenantGmailConnection(user, tokens, tenant),
    })
  } catch (err) {
    console.error('[email] gmail tenant callback error:', err)
    return res.redirect(getFrontendRedirectUrl('loopc', 'salesAiEmail=error'))
  }
})

module.exports = router
