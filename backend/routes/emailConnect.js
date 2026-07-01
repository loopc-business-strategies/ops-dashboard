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
  saveGmailConnection,
  disconnectEmail,
  getFrontendRedirectUrl,
  isGmailConfigured,
} = require('../services/email/emailInboxService')
const { isTokenEncryptionConfigured } = require('../utils/tokenEncryption')

const router = express.Router()

router.get('/connection', protect, async (req, res) => {
  try {
    assertSalesAiAccess(req)
    const status = await getConnectionStatus(req.user)
    res.json({ success: true, ...status })
  } catch (err) {
    const status = err.statusCode || 500
    res.status(status).json({ success: false, message: err.message || 'Could not load email connection.' })
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

router.get('/oauth/gmail/start', protect, (req, res) => {
  try {
    const tenant = assertSalesAiAccess(req)
    if (!isGmailConfigured() || !isTokenEncryptionConfigured()) {
      return res.status(503).json({ success: false, message: 'Gmail integration is not configured on the server.' })
    }
    const state = buildOAuthState(req.user._id, tenant)
    return res.redirect(buildGmailAuthUrl(state))
  } catch (err) {
    const status = err.statusCode || 500
    return res.status(status).json({ success: false, message: err.message || 'Could not start Gmail OAuth.' })
  }
})

router.get('/oauth/gmail/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '')
    const state = String(req.query.state || '')
    if (!code || !state) {
      return res.redirect(getFrontendRedirectUrl('loopc', 'salesAiEmail=error&reason=missing_code'))
    }

    const payload = parseOAuthState(state)
    const tenant = normalizeTenant(payload.tenant || 'loopc')
    const connection = await connectTenant(tenant)
    registerAllOnConnection(connection)

    await runWithTenantConnection(connection, tenant, async () => {
      const UserModel = await User.getTenantModel(tenant)
      const user = await UserModel.findById(payload.userId)
      if (!user) {
        res.redirect(getFrontendRedirectUrl(tenant, 'salesAiEmail=error&reason=user_not_found'))
        return
      }
      const tokens = await exchangeGmailCode(code)
      await saveGmailConnection(user, tokens)
      res.redirect(getFrontendRedirectUrl(tenant, 'salesAiEmail=connected'))
    })
  } catch (err) {
    console.error('[email] gmail callback error:', err)
    return res.redirect(getFrontendRedirectUrl('loopc', 'salesAiEmail=error'))
  }
})

module.exports = router
