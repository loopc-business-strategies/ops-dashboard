/**
 * Send Expo push notifications when EXPO_ACCESS_TOKEN is set (EAS / Expo push credentials).
 * Best-effort: failures are logged and never break the HTTP/socket path.
 */

const User = require('../models/User')
const { normalizeTenant } = require('../config/tenants')

let ExpoCtor = null
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  ExpoCtor = require('expo-server-sdk').Expo
} catch {
  ExpoCtor = null
}

const MAX_BODY = 220
const MAX_TITLE = 80

function isLikelyExpoPushToken(token) {
  const s = String(token || '').trim()
  return /^ExponentPushToken\[.+\]$/.test(s) || /^ExpoPushToken\[.+\]$/.test(s)
}

function buildCopy(type, data = {}) {
  const msg = typeof data.message === 'string' ? data.message.trim() : ''
  const sender = String(data.senderName || '').trim() || 'Someone'

  if (type === 'chat_message') {
    const isDm = String(data.channelType || '') === 'dm'
    const title = (isDm ? `DM · ${sender}` : `Chat · ${String(data.room || 'Group').trim() || 'Group'}`).slice(0, MAX_TITLE)
    const body = (isDm ? msg : `${sender}: ${msg}`).slice(0, MAX_BODY) || 'New message'
    return { title, body }
  }

  if (msg) {
    return { title: 'MG Ops', body: msg.slice(0, MAX_BODY) }
  }
  switch (type) {
    case 'transaction_chat_mention':
      return {
        title: 'Transaction mention',
        body: `${sender}: ${String(data.message || '').trim()}`.slice(0, MAX_BODY),
      }
    case 'chat_mention':
      return {
        title: 'Chat mention',
        body: `${sender} mentioned you`.slice(0, MAX_BODY),
      }
    case 'transaction_approved':
      return { title: 'Voucher approved', body: 'Your voucher was approved.'.slice(0, MAX_BODY) }
    case 'transaction_returned':
      return { title: 'Voucher returned', body: 'A voucher was returned for revision.'.slice(0, MAX_BODY) }
    case 'transaction_rejected':
      return { title: 'Voucher rejected', body: 'A voucher was rejected.'.slice(0, MAX_BODY) }
    default:
      return { title: 'MG Ops', body: String(type || 'Notification').slice(0, MAX_BODY) }
  }
}

/**
 * @param {string} tenantKey
 * @param {string} userId Mongo user id
 * @param {string} type notification type (matches Socket payload)
 * @param {object} data same as Socket `data`
 */
async function sendExpoPushToUser(tenantKey, userId, type, data = {}) {
  const accessToken = String(process.env.EXPO_ACCESS_TOKEN || '').trim()
  if (!accessToken || !ExpoCtor) return
  const tenant = normalizeTenant(tenantKey)
  if (!tenant || tenant === 'default') return

  const TenantUser = await User.getTenantModel(tenant)
  const user = await TenantUser.findById(userId).select('expoPushTokens isActive isDeleted')
  if (!user || user.isDeleted || user.isActive === false) return

  const rawTokens = (user.expoPushTokens || []).map((e) => e?.token).filter(isLikelyExpoPushToken)
  if (!rawTokens.length) return

  const expo = new ExpoCtor({ accessToken })
  const { title, body } = buildCopy(type, data)
  const messages = rawTokens.map((to) => ({
    to,
    sound: 'default',
    title: title.slice(0, MAX_TITLE),
    body: body.slice(0, MAX_BODY),
    data: {
      type: String(type || ''),
      ...Object.fromEntries(
        Object.entries(data).filter(([k]) => typeof k === 'string' && !k.startsWith('$')),
      ),
    },
  }))

  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk)
    } catch (err) {
      console.warn('[expo-push] send failed:', err?.message || err)
    }
  }
}

module.exports = { sendExpoPushToUser, isLikelyExpoPushToken }
