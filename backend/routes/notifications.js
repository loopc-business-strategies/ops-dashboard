const express = require('express')
const { protect } = require('../middleware/auth')
const { resolveRequestTenantKey } = require('../config/tenants')
const { mergeNotificationPreferences } = require('../services/notificationPreferences')
const { buildReportDigestText } = require('../services/reportDigestService')
const { notifyUsers } = require('../services/notificationDispatch')
const { MOBILE_APP_NAME } = require('../config/mobileApp')

const router = express.Router()

router.post('/report-digest/preview', protect, async (req, res) => {
  try {
    const tenant = String(resolveRequestTenantKey(req) || req.tenant || 'mg')
    const prefs = mergeNotificationPreferences(req.user.notificationPreferences)
    const text = await buildReportDigestText(tenant, prefs)
    res.json({ success: true, text })
  } catch (e) {
    console.error('report-digest preview', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/report-digest/send', protect, async (req, res) => {
  try {
    const tenant = String(resolveRequestTenantKey(req) || req.tenant || 'mg')
    const prefs = mergeNotificationPreferences(req.user.notificationPreferences)
    const text = await buildReportDigestText(tenant, prefs)
    const result = await notifyUsers(tenant, [String(req.user._id)], 'report_digest', {
      message: text,
      title: `${MOBILE_APP_NAME} report`,
    })
    res.json({ success: true, text, ...result })
  } catch (e) {
    console.error('report-digest send', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

module.exports = router
