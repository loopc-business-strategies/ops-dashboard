/**
 * Aggregate ledger amount*exchangeRate totals by debit/credit account.
 * Mirrors in-memory reduce used by trial balance / report summaries.
 */

async function aggregateLedgerAccountTotals(Ledger, match) {
  const amountExpr = { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] }
  const baseMatch = { isDeleted: { $ne: true }, ...(match || {}) }

  const [debitAgg, creditAgg] = await Promise.all([
    Ledger.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$debitAccountId', total: { $sum: amountExpr } } },
    ]),
    Ledger.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$creditAccountId', total: { $sum: amountExpr } } },
    ]),
  ])

  const debitMap = new Map()
  const creditMap = new Map()
  debitAgg.forEach((row) => {
    if (row._id == null) return
    debitMap.set(String(row._id), Number(row.total || 0))
  })
  creditAgg.forEach((row) => {
    if (row._id == null) return
    creditMap.set(String(row._id), Number(row.total || 0))
  })
  return { debitMap, creditMap }
}

module.exports = {
  aggregateLedgerAccountTotals,
}
