const { escapeRegex } = require('./escapeRegex')

/**
 * Build Mongo $or clauses for ledger list text search.
 * @param {string} search
 * @param {Array<{ _id: unknown }>} [matchingAccounts]
 * @returns {object[]|null}
 */
function buildLedgerListSearchOr(search, matchingAccounts = []) {
  const searchTerm = String(search || '').trim()
  if (!searchTerm) return null
  const regex = new RegExp(escapeRegex(searchTerm), 'i')
  const searchOr = [
    { description: regex },
    { notes: regex },
    { autoTxNo: regex },
    { chequeNo: regex },
  ]
  const accountIds = (matchingAccounts || []).map((row) => row?._id).filter(Boolean)
  if (accountIds.length) {
    searchOr.push({ debitAccountId: { $in: accountIds } })
    searchOr.push({ creditAccountId: { $in: accountIds } })
  }
  return searchOr
}

module.exports = {
  buildLedgerListSearchOr,
}
