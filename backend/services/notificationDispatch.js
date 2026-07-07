const User = require('../models/User')
const { deriveErpAccessPolicy } = require('./erpAccounting/accessPolicy')
const { isTopicEnabled } = require('./notificationPreferences')
const {
  formatNotificationMoney,
  formatNotificationAccountLabel,
  resolveVoucherPartyLabel,
  resolveVoucherRef,
  buildVoucherWorkflowMessage,
} = require('./voucherNotificationHelpers')

let realtimeServerRef = null

function setNotificationRealtimeServer(server) {
  realtimeServerRef = server
}

function userHasErpAccess(user) {
  if (!user || user.isDeleted || user.isActive === false) return false
  const policy = deriveErpAccessPolicy(user)
  return Boolean(policy?.canAccessERP)
}

async function listErpUserIds(tenant) {
  const TenantUser = await User.getTenantModel(tenant)
  const rows = await TenantUser.find({ isDeleted: { $ne: true }, isActive: { $ne: false } })
    .select('_id role department modulePermissions notificationPreferences')
    .lean()
  return rows.filter(userHasErpAccess).map((u) => String(u._id))
}

async function filterUserIdsByTopic(tenant, userIds, type) {
  const unique = Array.from(new Set((userIds || []).map((id) => String(id)).filter(Boolean)))
  if (!unique.length) return []

  const TenantUser = await User.getTenantModel(tenant)
  const rows = await TenantUser.find({ _id: { $in: unique } })
    .select('_id notificationPreferences isActive isDeleted')
    .lean()

  return rows
    .filter((u) => u && u.isDeleted !== true && u.isActive !== false)
    .filter((u) => isTopicEnabled(u.notificationPreferences, type))
    .map((u) => String(u._id))
}

async function notifyUsers(tenant, userIds, type, data = {}) {
  if (!realtimeServerRef || typeof realtimeServerRef.sendUserNotification !== 'function') {
    return { sent: 0, skipped: (userIds || []).length }
  }

  const allowed = await filterUserIdsByTopic(tenant, userIds, type)
  for (const userId of allowed) {
    realtimeServerRef.sendUserNotification(userId, type, data, tenant)
  }
  return { sent: allowed.length, skipped: Math.max(0, (userIds || []).length - allowed.length) }
}

async function notifyErpUsers(tenant, type, data = {}) {
  const ids = await listErpUserIds(tenant)
  return notifyUsers(tenant, ids, type, data)
}

function buildVoucherNotificationData(tx, extra = {}) {
  const vocNo = resolveVoucherRef(tx)
  const amount = Number(tx?.amount || 0)
  const currency = String(tx?.currency || 'USD').toUpperCase()
  const partyName = String(tx?.voucherMeta?.partyName || '').trim()
  const partyCode = String(tx?.voucherMeta?.partyCode || '').trim()
  const partyLabel = resolveVoucherPartyLabel(tx)
  const debitAccountName = formatNotificationAccountLabel(tx?.debitAccountId)
  const creditAccountName = formatNotificationAccountLabel(tx?.creditAccountId)
  const formattedAmount = formatNotificationMoney(amount, currency)
  const actorName = String(extra.actorName || '').trim()
  const action = String(extra.action || '').trim()
  const comment = String(extra.comment || '').trim()
  const message = extra.message
    || (action ? buildVoucherWorkflowMessage(tx, { action, actorName, comment }) : '')

  return {
    transactionId: String(tx?._id || ''),
    type: tx?.type,
    vocNo,
    amount,
    currency,
    party: partyCode || partyName || partyLabel,
    partyName,
    partyLabel,
    debitAccountName,
    creditAccountName,
    formattedAmount,
    status: tx?.status,
    actorName,
    message,
    ...extra,
  }
}

module.exports = {
  setNotificationRealtimeServer,
  userHasErpAccess,
  listErpUserIds,
  filterUserIdsByTopic,
  notifyUsers,
  notifyErpUsers,
  buildVoucherNotificationData,
}
