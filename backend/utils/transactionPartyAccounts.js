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

  if (type === 'sale') {
    return { debitAccountId: debitAccountId || partyAccountId, creditAccountId }
  }

  if (type === 'purchase') {
    return { debitAccountId, creditAccountId: creditAccountId || partyAccountId }
  }

  return { debitAccountId, creditAccountId }
}

module.exports = {
  applyPartyAccountPriority,
}