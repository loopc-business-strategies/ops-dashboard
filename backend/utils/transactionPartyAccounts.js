const {
  _isMetalStockInType,
  _isMetalStockOutType,
  _isMetalStockType,
} = require('./metalStockVoucherTypes')

function applyPartyAccountPriority({
  transactionType,
  debitAccountId,
  creditAccountId,
  directPartyAccountId,
}) {
  const type = String(transactionType || '').toLowerCase()
  const partyAccountId = directPartyAccountId || null

  if (!partyAccountId) {
    return { debitAccountId, creditAccountId }
  }

  if (type === 'receipt') {
    return { debitAccountId, creditAccountId: partyAccountId }
  }

  if (type === 'payment') {
    return { debitAccountId: partyAccountId, creditAccountId }
  }

  if (type === 'sale' || type === 'metal_payment') {
    // Voucher party is the AR / counterparty ledger — prefer it over a stale customer.ledgerAccountId.
    return { debitAccountId: partyAccountId || debitAccountId, creditAccountId }
  }

  if (type === 'purchase' || type === 'metal_receipt') {
    // Voucher party is the AP / counterparty ledger — prefer it over a stale vendor.ledgerAccountId
    // (otherwise postings hit e.g. 2000 while the user views vendor sub-account 2305 and sees zero balance).
    return { debitAccountId, creditAccountId: partyAccountId || creditAccountId }
  }

  return { debitAccountId, creditAccountId }
}

module.exports = {
  applyPartyAccountPriority,
}