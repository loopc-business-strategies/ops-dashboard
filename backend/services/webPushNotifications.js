/**
 * Web Push (browser desktop / mobile Chrome) when WEB_PUSH_PUBLIC_KEY + WEB_PUSH_PRIVATE_KEY are set.
 * Uses the same title/body copy as Expo push (shared buildCopy from expoPushNotifications).
 */

const User = require('../models/User')
const { normalizeTenant } = require('../config/tenants')
const { buildCopy } = require('./expoPushNotifications')

let WebPush = null
try {
   
  WebPush = require('web-push')
} catch {
  WebPush = null
}

let vapidConfigured = false

function ensureVapid() {
  if (!WebPush) return false
  const publicKey = String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim()
  const privateKey = String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim()
  const subject = String(process.env.WEB_PUSH_SUBJECT || 'mailto:support@loopcstrategies.com').trim()
  if (!publicKey || !privateKey) return false
  if (!vapidConfigured) {
    WebPush.setVapidDetails(subject, publicKey, privateKey)
    vapidConfigured = true
  }
  return true
}

function safePayload(type, data, title, body) {
  const dataObj = {
    type: String(type || ''),
    ...Object.fromEntries(
      Object.entries(data || {}).filter(([k]) => typeof k === 'string' && !k.startsWith('$')),
    ),
  }
  return JSON.stringify({
    title,
    body,
    ...dataObj,
    url: '/dashboard',
  })
}

/**
 * @param {string} tenantKey
 * @param {string} userId
 * @param {string} type
 * @param {object} data
 */
async function sendWebPushToUser(tenantKey, userId, type, data = {}) {
  if (!ensureVapid()) return

  const tenant = normalizeTenant(tenantKey)
  if (!tenant || tenant === 'default') return

  const TenantUser = await User.getTenantModel(tenant)
  const user = await TenantUser.findById(userId).select('webPushSubscriptions isActive isDeleted')
  if (!user || user.isDeleted || user.isActive === false) return

  const subs = Array.isArray(user.webPushSubscriptions) ? user.webPushSubscriptions : []
  const rows = subs.filter((s) => s?.endpoint && s?.keys?.p256dh && s?.keys?.auth)
  if (!rows.length) return

  const { title, body } = buildCopy(type, data)
  const payload = safePayload(type, data, title, body)
  const staleEndpoints = []

  for (const row of rows) {
    const subscription = {
      endpoint: String(row.endpoint),
      keys: {
        p256dh: String(row.keys.p256dh),
        auth: String(row.keys.auth),
      },
    }
    try {
      await WebPush.sendNotification(subscription, payload, { TTL: 3600 })
    } catch (err) {
      const code = err?.statusCode
      if (code === 404 || code === 410) staleEndpoints.push(subscription.endpoint)
      else console.warn('[web-push] send failed:', err?.message || err)
    }
  }

  if (staleEndpoints.length) {
    user.webPushSubscriptions = (user.webPushSubscriptions || []).filter(
      (s) => !staleEndpoints.includes(String(s?.endpoint || '')),
    )
    await user.save({ validateBeforeSave: false })
  }
}

module.exports = { sendWebPushToUser }
