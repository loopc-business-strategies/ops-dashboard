const DIRECT_DEAL_REOPEN_REASON_MIN_LENGTH = 5

const HEADER_FIELDS = ['docNo', 'entryType', 'currency', 'branch']
const DATE_FIELDS = ['docDate', 'valueDate']
const LINE_FIELDS = ['direction', 'metal', 'qty', 'stockCode', 'price']

const toDay = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const lineCustomerKey = (line) => String(line?.customerId?._id || line?.customerId || '')
const lineCustomerLabel = (line) => String(line?.customerName || line?.customerCode || lineCustomerKey(line) || '')
const describeLine = (line) => [
  String(line?.direction || '').toUpperCase(),
  line?.qty,
  line?.stockCode,
  String(line?.metal || ''),
  '@',
  line?.price,
  lineCustomerLabel(line),
].filter((part) => part !== undefined && part !== null && part !== '').join(' ')

/** Field-level differences between two versions of a direct deal, for the audit history. */
function diffDirectDeals(before = {}, after = {}) {
  const changes = []
  HEADER_FIELDS.forEach((field) => {
    const from = String(before[field] ?? '')
    const to = String(after[field] ?? '')
    if (from !== to) changes.push({ line: 0, field, from, to })
  })
  DATE_FIELDS.forEach((field) => {
    const from = toDay(before[field])
    const to = toDay(after[field])
    if (from !== to) changes.push({ line: 0, field, from, to })
  })

  const beforeLines = Array.isArray(before.lineItems) ? before.lineItems : []
  const afterLines = Array.isArray(after.lineItems) ? after.lineItems : []
  const lineCount = Math.max(beforeLines.length, afterLines.length)
  for (let idx = 0; idx < lineCount; idx += 1) {
    const prev = beforeLines[idx]
    const next = afterLines[idx]
    const line = idx + 1
    if (!prev) {
      changes.push({ line, field: 'line', from: '', to: describeLine(next) })
      continue
    }
    if (!next) {
      changes.push({ line, field: 'line', from: describeLine(prev), to: '' })
      continue
    }
    if (lineCustomerKey(prev) !== lineCustomerKey(next)) {
      changes.push({ line, field: 'customer', from: lineCustomerLabel(prev), to: lineCustomerLabel(next) })
    }
    LINE_FIELDS.forEach((field) => {
      const from = String(prev[field] ?? '')
      const to = String(next[field] ?? '')
      if (from !== to) changes.push({ line, field, from, to })
    })
  }
  return changes
}

function buildDirectDealHistoryEntry({ action, user, reason = '', changes = [] }) {
  return {
    action,
    at: new Date(),
    by: user?._id || null,
    byName: String(user?.name || ''),
    reason: String(reason || '').trim(),
    changes,
  }
}

function hasDirectDealBeenConfirmed(deal) {
  if (String(deal?.status || '') === 'confirmed') return true
  return (deal?.history || []).some((entry) => ['confirmed', 'reopened'].includes(entry.action))
}

function isValidDirectDealReason(reason) {
  return String(reason || '').trim().length >= DIRECT_DEAL_REOPEN_REASON_MIN_LENGTH
}

module.exports = {
  DIRECT_DEAL_REOPEN_REASON_MIN_LENGTH,
  diffDirectDeals,
  buildDirectDealHistoryEntry,
  hasDirectDealBeenConfirmed,
  isValidDirectDealReason,
}
