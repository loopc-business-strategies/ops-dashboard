const MAX_NOTIFICATION_BODY = 220

function formatNotificationMoney(amount, currency = 'USD') {
  const n = Number(amount || 0)
  const cur = String(currency || 'USD').trim().toUpperCase() || 'USD'
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `$${formatted} ${cur}`
}

function formatNotificationAccountLabel(account) {
  if (!account) return ''
  if (typeof account === 'string') return account.trim()
  const name = String(account.accountName || '').trim()
  const code = String(account.accountCode || '').trim()
  if (name && code) return `${name} (${code})`
  return name || code || ''
}

function resolvePopulatedName(ref) {
  if (!ref) return ''
  if (typeof ref === 'object' && ref.name) return String(ref.name).trim()
  return ''
}

function resolveVoucherRef(tx) {
  return String(tx?.voucherMeta?.vocNo || tx?.voucherMeta?.refNo || '').trim()
}

function resolveVoucherPartyLabel(tx) {
  const partyName = String(tx?.voucherMeta?.partyName || '').trim()
  if (partyName) return partyName

  const partyCode = String(tx?.voucherMeta?.partyCode || '').trim()
  if (partyCode) return partyCode

  const vendorName = resolvePopulatedName(tx?.vendorId)
  if (vendorName) return vendorName

  const customerName = resolvePopulatedName(tx?.customerId)
  if (customerName) return customerName

  return resolveVoucherFallbackAccountLabel(tx)
}

function resolveVoucherFallbackAccountLabel(tx) {
  const type = String(tx?.type || '').toLowerCase()
  if (type === 'payment' || type === 'sale' || type === 'expense' || type === 'payroll') {
    return formatNotificationAccountLabel(tx?.creditAccountId)
  }
  if (type === 'receipt' || type === 'purchase' || type === 'metal_receipt') {
    return formatNotificationAccountLabel(tx?.debitAccountId)
  }
  if (type === 'metal_payment') {
    return formatNotificationAccountLabel(tx?.creditAccountId)
      || formatNotificationAccountLabel(tx?.debitAccountId)
  }
  return formatNotificationAccountLabel(tx?.creditAccountId)
    || formatNotificationAccountLabel(tx?.debitAccountId)
}

function resolveVoucherCounterpartyPhrase(tx, partyLabel) {
  const type = String(tx?.type || '').toLowerCase()
  const label = String(partyLabel || '').trim()
  if (!label) return ''

  if (type === 'receipt' || type === 'purchase' || type === 'metal_receipt') {
    return `from ${label}`
  }
  if (type === 'payment' || type === 'sale' || type === 'expense' || type === 'payroll' || type === 'metal_payment') {
    return `to ${label}`
  }
  return `for ${label}`
}

function voucherKindLabel(type) {
  const t = String(type || '').trim().toLowerCase()
  if (!t) return 'Voucher'
  if (t === 'metal_receipt') return 'Metal receipt'
  if (t === 'metal_payment') return 'Metal payment'
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}`
}

function actionPastTense(action) {
  const a = String(action || '').trim().toLowerCase()
  const map = {
    submitted: 'submitted',
    approved: 'approved',
    posted: 'posted',
    returned: 'returned',
    rejected: 'rejected',
  }
  return map[a] || a || 'updated'
}

function truncateNotificationBody(text, max = MAX_NOTIFICATION_BODY) {
  const s = String(text || '').trim()
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trim()}…`
}

function buildVoucherWorkflowMessage(tx, { action, actorName = '', comment = '' } = {}) {
  const ref = resolveVoucherRef(tx)
  const amount = formatNotificationMoney(tx?.amount, tx?.currency)
  const partyLabel = resolveVoucherPartyLabel(tx)
  const counterparty = resolveVoucherCounterpartyPhrase(tx, partyLabel)
  const actor = String(actorName || '').trim()
  const verb = actionPastTense(action)

  const parts = []
  if (ref) parts.push(ref)
  parts.push(counterparty ? `${amount} ${counterparty}` : amount)
  if (actor) parts.push(`${verb} by ${actor}`)

  let message = parts.join(' · ')
  const note = String(comment || '').trim()
  if (note) {
    const suffix = action === 'returned' ? `Note: ${note}` : action === 'rejected' ? `Reason: ${note}` : note
    message = `${message} · ${suffix}`
  }

  return truncateNotificationBody(message)
}

function buildJvPostedMessage({ vocNo = '', amount = 0, currency = 'USD', debitLabel = '', creditLabel = '', isBankJv = false } = {}) {
  const label = isBankJv ? 'Bank JV' : 'JV'
  const ref = String(vocNo || '').trim() || label
  const money = formatNotificationMoney(amount, currency)
  const debit = String(debitLabel || '').trim()
  const credit = String(creditLabel || '').trim()

  const parts = [ref, money]
  if (debit && credit) parts.push(`${debit} → ${credit}`)
  else if (debit) parts.push(debit)
  else if (credit) parts.push(credit)

  return truncateNotificationBody(parts.join(' · '))
}

function buildVoucherNotificationTitle(notificationType, voucherType) {
  const kind = voucherKindLabel(voucherType)
  const type = String(notificationType || '').trim().toLowerCase()

  if (type === 'voucher_submitted' || type === 'transaction_submitted') return `${kind} submitted`
  if (type === 'voucher_approved' || type === 'transaction_approved') return `${kind} approved`
  if (type === 'voucher_posted' || type === 'transaction_posted') return `${kind} posted`
  if (type === 'voucher_returned' || type === 'transaction_returned') return `${kind} returned`
  if (type === 'voucher_rejected' || type === 'transaction_rejected') return `${kind} rejected`
  if (type === 'jv_posted') return 'Journal posted'
  return 'Voucher update'
}

module.exports = {
  MAX_NOTIFICATION_BODY,
  formatNotificationMoney,
  formatNotificationAccountLabel,
  resolveVoucherRef,
  resolveVoucherPartyLabel,
  resolveVoucherFallbackAccountLabel,
  buildVoucherWorkflowMessage,
  buildJvPostedMessage,
  buildVoucherNotificationTitle,
  voucherKindLabel,
}
