/**
 * Send Expo push notifications when EXPO_ACCESS_TOKEN is set (EAS / Expo push credentials).
 * Best-effort: failures are logged and never break the HTTP/socket path.
 */

const User = require('../models/User')
const { normalizeTenant } = require('../config/tenants')
const { MOBILE_APP_NAME } = require('../config/mobileApp')
const { buildVoucherNotificationTitle } = require('./voucherNotificationHelpers')

let ExpoCtor = null
try {
   
  ExpoCtor = require('expo-server-sdk').Expo
} catch {
  ExpoCtor = null
}

const MAX_BODY = 220
const MAX_TITLE = 80
const ANDROID_CHANNEL_ID = 'default'

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

  if (type === 'report_digest') {
    return {
      title: String(data.title || `${MOBILE_APP_NAME} report`).slice(0, MAX_TITLE),
      body: (msg || 'Daily report').slice(0, MAX_BODY),
    }
  }

  if (msg) {
    const voucherTypes = new Set([
      'transaction_approved',
      'transaction_returned',
      'transaction_rejected',
      'transaction_submitted',
      'transaction_posted',
      'voucher_approved',
      'voucher_returned',
      'voucher_rejected',
      'voucher_submitted',
      'voucher_posted',
      'jv_posted',
    ])
    if (voucherTypes.has(String(type || ''))) {
      const title = buildVoucherNotificationTitle(type, data.type).slice(0, MAX_TITLE)
      return { title, body: msg.slice(0, MAX_BODY) }
    }
    return { title: MOBILE_APP_NAME, body: msg.slice(0, MAX_BODY) }
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
    case 'voucher_approved':
      return { title: 'Voucher approved', body: (msg || 'A voucher was approved.').slice(0, MAX_BODY) }
    case 'transaction_returned':
    case 'voucher_returned':
      return { title: 'Voucher returned', body: (msg || 'A voucher was returned for revision.').slice(0, MAX_BODY) }
    case 'transaction_rejected':
    case 'voucher_rejected':
      return { title: 'Voucher rejected', body: (msg || 'A voucher was rejected.').slice(0, MAX_BODY) }
    case 'transaction_submitted':
    case 'voucher_submitted':
      return { title: 'Voucher submitted', body: (msg || 'A voucher was submitted for approval.').slice(0, MAX_BODY) }
    case 'transaction_posted':
    case 'voucher_posted':
      return { title: 'Voucher posted', body: (msg || 'A voucher was posted to the ledger.').slice(0, MAX_BODY) }
    case 'jv_posted':
      return { title: 'Journal posted', body: (msg || 'A journal voucher was posted.').slice(0, MAX_BODY) }
    case 'task_due':
      return { title: 'Task due today', body: (msg || String(data.title || 'Task due today')).slice(0, MAX_BODY) }
    case 'task_overdue':
      return { title: 'Task overdue', body: (msg || String(data.title || 'Task overdue')).slice(0, MAX_BODY) }
    case 'vendor_due':
      return { title: 'Vendor payment due', body: (msg || String(data.vendorName || 'Vendor payment due soon')).slice(0, MAX_BODY) }
    case 'vendor_overdue':
      return { title: 'Vendor overdue', body: (msg || String(data.vendorName || 'Vendor payment overdue')).slice(0, MAX_BODY) }
    case 'report_digest':
      return { title: String(data.title || `${MOBILE_APP_NAME} report`).slice(0, MAX_TITLE), body: (msg || 'Daily report').slice(0, MAX_BODY) }
    case 'gold_price_alert':
      return { title: 'Gold price alert', body: (msg || 'Gold price moved significantly.').slice(0, MAX_BODY) }
    case 'account_balance_sign_changed':
      return { title: 'Account crossed zero', body: 'An account balance changed from negative to positive or vice versa.'.slice(0, MAX_BODY) }
    default:
      return { title: MOBILE_APP_NAME, body: String(type || 'Notification').slice(0, MAX_BODY) }
  }
}

async function pruneInvalidExpoToken(tenant, userId, invalidToken) {
  const token = String(invalidToken || '').trim()
  if (!token || !tenant || !userId) return
  const TenantUser = await User.getTenantModel(tenant)
  await TenantUser.updateOne(
    { _id: userId },
    { $pull: { expoPushTokens: { token } } },
  )
}

function buildExpoMessage(to, type, data, title, body) {
  return {
    to,
    sound: 'default',
    title: title.slice(0, MAX_TITLE),
    body: body.slice(0, MAX_BODY),
    priority: 'high',
    channelId: ANDROID_CHANNEL_ID,
    data: {
      type: String(type || ''),
      ...Object.fromEntries(
        Object.entries(data).filter(([k]) => typeof k === 'string' && !k.startsWith('$')),
      ),
    },
  }
}

async function handleExpoTickets(expo, tickets, chunk, tenant, userId) {
  const invalidTokens = []
  tickets.forEach((ticket, index) => {
    if (ticket?.status !== 'error') return
    const token = String(chunk[index]?.to || '').trim()
    const detailError = ticket?.details?.error
    console.warn('[expo-push] ticket error:', ticket?.message || 'unknown', detailError || '', token ? `token=${token.slice(0, 24)}…` : '')
    if (detailError === 'DeviceNotRegistered' && token) invalidTokens.push(token)
  })
  await Promise.all(invalidTokens.map((token) => pruneInvalidExpoToken(tenant, userId, token).catch((err) => {
    console.warn('[expo-push] prune token failed:', err?.message || err)
  })))

  const receiptIds = tickets
    .map((ticket) => (ticket?.status === 'ok' ? ticket.id : null))
    .filter(Boolean)
  if (!receiptIds.length || typeof expo.getPushNotificationReceiptsAsync !== 'function') return

  try {
    const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds)
    await Promise.all(Object.entries(receipts || {}).map(async ([, receipt]) => {
      if (receipt?.status !== 'error') return
      const detailError = receipt?.details?.error
      console.warn('[expo-push] receipt error:', receipt?.message || 'unknown', detailError || '')
    }))
  } catch (err) {
    console.warn('[expo-push] receipt fetch failed:', err?.message || err)
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
  const messages = rawTokens.map((to) => buildExpoMessage(to, type, data, title, body))

  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk)
      await handleExpoTickets(expo, tickets, chunk, tenant, userId)
    } catch (err) {
      console.warn('[expo-push] send failed:', err?.message || err)
    }
  }
}

module.exports = {
  sendExpoPushToUser,
  isLikelyExpoPushToken,
  buildCopy,
  buildExpoMessage,
  pruneInvalidExpoToken,
}
