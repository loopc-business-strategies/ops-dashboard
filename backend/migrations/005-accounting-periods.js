/**
 * Create AccountingPeriod indexes and seed OPEN monthly/yearly periods
 * for calendar years that already have ledger or transaction dates.
 * Never closes any period. Never mutates accounting amounts.
 */
module.exports = {
  id: '005-accounting-periods',
  async up({ tenant, connection }) {
    if (!connection) {
      throw new Error(`[${tenant}] connection required`)
    }

    // Ensure model is registered
    require('../models/AccountingPeriod')
    require('../models/Ledger')
    require('../models/Transaction')
    const { registerAllOnConnection } = require('../db/tenantModelRegistry')
    registerAllOnConnection(connection)

    const AccountingPeriod = connection.models.AccountingPeriod
    const Ledger = connection.models.Ledger
    const Transaction = connection.models.Transaction

    await AccountingPeriod.syncIndexes()

    const years = new Set()
    const addYear = (value) => {
      if (!value) return
      const d = value instanceof Date ? value : new Date(value)
      if (Number.isNaN(d.getTime())) return
      years.add(d.getUTCFullYear())
    }

    const ledgerDates = await Ledger.find({ isDeleted: { $ne: true } }).select('date').lean()
    for (const row of ledgerDates) addYear(row.date)

    const txs = await Transaction.find({ isDeleted: { $ne: true } })
      .select('date voucherMeta.valueDate')
      .lean()
    for (const tx of txs) {
      addYear(tx.voucherMeta?.valueDate)
      addYear(tx.date)
    }

    // Always include current calendar year so UI has something to show
    years.add(new Date().getUTCFullYear())

    let created = 0
    for (const year of [...years].sort()) {
      const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0))
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
      const yearly = await AccountingPeriod.findOneAndUpdate(
        { periodType: 'YEARLY', financialYear: year, month: null },
        {
          $setOnInsert: {
            periodType: 'YEARLY',
            financialYear: year,
            month: null,
            startDate: yearStart,
            endDate: yearEnd,
            status: 'OPEN',
          },
        },
        { upsert: true, new: true },
      )
      if (yearly.createdAt && yearly.updatedAt && +yearly.createdAt === +yearly.updatedAt) created += 1

      for (let month = 1; month <= 12; month += 1) {
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
        const monthly = await AccountingPeriod.findOneAndUpdate(
          { periodType: 'MONTHLY', financialYear: year, month },
          {
            $setOnInsert: {
              periodType: 'MONTHLY',
              financialYear: year,
              month,
              startDate,
              endDate,
              status: 'OPEN',
            },
          },
          { upsert: true, new: true },
        )
        if (monthly.createdAt && monthly.updatedAt && +monthly.createdAt === +monthly.updatedAt) created += 1
      }
    }

    console.log(`[${tenant}] accounting periods seeded (OPEN only); years=${[...years].join(',')}; touched≈${created}`)
  },
}
