/**
 * Single-account ledger balance helpers (outstanding + aging buckets).
 * Keeps aggregation logic out of `erp-accountingContext` wiring.
 *
 * @param {{ Ledger: import('mongoose').Model }} deps
 * @returns {{ getOutstandingForAccount: (accountId: unknown) => Promise<number>, getAgingForAccount: (accountId: unknown, asOfDate?: Date) => Promise<object> }}
 */
function createLedgerBalanceService({ Ledger }) {
  const getOutstandingForAccount = async (accountId) => {
    if (!accountId) return 0

    const totals = await Ledger.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
        },
      },
      {
        $project: {
          amountSigned: {
            $cond: [
              { $eq: ['$debitAccountId', accountId] },
              { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] },
              { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }, -1] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          balance: { $sum: '$amountSigned' },
        },
      },
    ])

    return totals[0]?.balance || 0
  }

  const getAgingForAccount = async (accountId, asOfDate = new Date()) => {
    if (!accountId) {
      return {
        bucket0to30: 0,
        bucket31to60: 0,
        bucket61to90: 0,
        bucket90Plus: 0,
        total: 0,
      }
    }

    const entries = await Ledger.find({
      isDeleted: { $ne: true },
      $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
    })
      .select('date debitAccountId creditAccountId amount exchangeRate')
      .sort({ date: 1, _id: 1 })

    const openDebits = []
    const accountKey = accountId.toString()

    entries.forEach((entry) => {
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      const debitMatch = entry.debitAccountId?.toString() === accountKey
      const creditMatch = entry.creditAccountId?.toString() === accountKey

      if (debitMatch && amount > 0) {
        openDebits.push({ date: entry.date, remaining: amount })
        return
      }

      if (creditMatch && amount > 0) {
        let creditLeft = amount
        for (const debit of openDebits) {
          if (creditLeft <= 0) break
          if (debit.remaining <= 0) continue
          const applied = Math.min(debit.remaining, creditLeft)
          debit.remaining -= applied
          creditLeft -= applied
        }
      }
    })

    const buckets = {
      bucket0to30: 0,
      bucket31to60: 0,
      bucket61to90: 0,
      bucket90Plus: 0,
      total: 0,
    }

    openDebits.forEach((debit) => {
      if (debit.remaining <= 0) return

      const ageMs = new Date(asOfDate) - new Date(debit.date)
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
      buckets.total += debit.remaining

      if (ageDays <= 30) buckets.bucket0to30 += debit.remaining
      else if (ageDays <= 60) buckets.bucket31to60 += debit.remaining
      else if (ageDays <= 90) buckets.bucket61to90 += debit.remaining
      else buckets.bucket90Plus += debit.remaining
    })

    return buckets
  }

  return { getOutstandingForAccount, getAgingForAccount }
}

module.exports = { createLedgerBalanceService }
