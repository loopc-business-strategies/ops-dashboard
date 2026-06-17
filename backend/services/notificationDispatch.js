const User = require('../models/User')
const { deriveErpAccessPolicy } = require('./erpAccounting/accessPolicy')
const { isTopicEnabled } = require('./notificationPreferences')

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
  const vocNo = String(tx?.voucherMeta?.vocNo || tx?.voucherMeta?.refNo || '').trim()
  const amount = Number(tx?.amount || 0)
  const currency = String(tx?.currency || 'USD').toUpperCase()
  const party = String(tx?.voucherMeta?.partyCode || tx?.voucherMeta?.partyName || '').trim()
  return {
    transactionId: String(tx?._id || ''),
    type: tx?.type,
    vocNo,
    amount,
    currency,
    party,
    status: tx?.status,
    message: extra.message || '',
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
