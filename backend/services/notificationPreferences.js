const DEFAULT_NOTIFICATION_TOPICS = {
  voucher_submitted: true,
  voucher_approved: true,
  voucher_posted: true,
  voucher_returned: true,
  voucher_rejected: true,
  jv_posted: true,
  task_due: true,
  task_overdue: true,
  vendor_due: true,
  vendor_overdue: true,
  chat_message: true,
  chat_mention: true,
  report_digest: true,
  gold_price_alert: true,
  low_stock: true,
  // legacy aliases still stored in older payloads
  transaction_approved: true,
  transaction_returned: true,
  transaction_rejected: true,
  transaction_chat_mention: true,
  account_balance_sign_changed: true,
}

const DEFAULT_REPORT_DIGEST = {
  enabled: true,
  timeLocal: '08:00',
  includeExpensesToday: true,
  includeSalesToday: true,
  includeBankCashBalance: true,
  includeGoldPrice: true,
}

const TOPIC_ALIASES = {
  transaction_approved: 'voucher_approved',
  transaction_returned: 'voucher_returned',
  transaction_rejected: 'voucher_rejected',
  transaction_submitted: 'voucher_submitted',
  transaction_posted: 'voucher_posted',
}

function normalizeTopicKey(type) {
  const key = String(type || '').trim()
  return TOPIC_ALIASES[key] || key
}

function mergeNotificationPreferences(input = {}) {
  const topics = {
    ...DEFAULT_NOTIFICATION_TOPICS,
    ...(input.topics && typeof input.topics === 'object' ? input.topics : {}),
  }
  const reportDigest = {
    ...DEFAULT_REPORT_DIGEST,
    ...(input.reportDigest && typeof input.reportDigest === 'object' ? input.reportDigest : {}),
  }
  return { topics, reportDigest }
}

function isTopicEnabled(preferences, type) {
  const merged = mergeNotificationPreferences(preferences)
  const key = normalizeTopicKey(type)
  if (Object.prototype.hasOwnProperty.call(merged.topics, key)) {
    return merged.topics[key] !== false
  }
  return true
}

module.exports = {
  DEFAULT_NOTIFICATION_TOPICS,
  DEFAULT_REPORT_DIGEST,
  mergeNotificationPreferences,
  normalizeTopicKey,
  isTopicEnabled,
}
