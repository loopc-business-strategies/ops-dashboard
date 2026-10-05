const { runJvLedgerFxBackfillOnNativeDb } = require('../services/jvLedgerFxBackfill')

const matchesFilter = (doc, filter = {}) => Object.entries(filter).every(([key, cond]) => {
  if (cond && typeof cond === 'object') {
    if ('$ne' in cond) return doc[key] !== cond.$ne
    if ('$in' in cond) return cond.$in.includes(doc[key])
  }
  return doc[key] === cond
})

function makeFakeDb({ ledgers }) {
  const collections = {
    currencies: [
      { code: 'USD', baseCurrency: true, isActive: true, exchangeRate: 1 },
      { code: 'UZS', isActive: true, exchangeRate: 1 / 12100 },
    ],
    chartofaccounts: [
      { _id: 'usdBank', accountCode: '101001', currency: 'USD' },
      { _id: 'uzsBank', accountCode: '101002', currency: 'UZS' },
      { _id: 'fxLoss', accountCode: '5190', currency: '' },
    ],
    ledgers,
  }
  const updates = []
  return {
    updates,
    collection(name) {
      const rows = collections[name] || []
      return {
        findOne: async (filter) => rows.find((r) => matchesFilter(r, filter)) || null,
        find: (filter) => {
          const matched = rows.filter((r) => matchesFilter(r, filter))
          return { toArray: async () => matched, project: () => ({ toArray: async () => matched }) }
        },
        updateOne: async (filter, update) => { updates.push({ filter, update }) },
      }
    },
  }
}

const usdConversionRows = (referenceType) => [
  { _id: `${referenceType}-1`, referenceType, referenceId: `${referenceType}-g`, amount: 3201.27, currency: 'USD', exchangeRate: 1, debitAccountId: 'uzsBank', creditAccountId: 'usdBank', description: 'BnkJV/2026/0099' },
  { _id: `${referenceType}-2`, referenceType, referenceId: `${referenceType}-g`, amount: 98.73, currency: 'USD', exchangeRate: 1, debitAccountId: 'fxLoss', creditAccountId: 'usdBank', description: 'BnkJV/2026/0099' },
]

describe('runJvLedgerFxBackfillOnNativeDb', () => {
  test('never rewrites bank_jv rows saved in base currency', async () => {
    const db = makeFakeDb({ ledgers: usdConversionRows('bank_jv') })
    const result = await runJvLedgerFxBackfillOnNativeDb(db, { dryRun: false, mode: 'coa' })
    expect(result.candidateRows).toBe(0)
    expect(result.updated).toBe(0)
    expect(db.updates).toHaveLength(0)
  })

  test('force mode also leaves bank_jv rows alone', async () => {
    const db = makeFakeDb({ ledgers: usdConversionRows('bank_jv') })
    const result = await runJvLedgerFxBackfillOnNativeDb(db, { dryRun: false, mode: 'force', forceCurrency: 'UZS' })
    expect(result.updated).toBe(0)
    expect(db.updates).toHaveLength(0)
  })

  test('still converts legacy journal rows to the inferred foreign currency', async () => {
    const db = makeFakeDb({ ledgers: [...usdConversionRows('journal'), ...usdConversionRows('bank_jv')] })
    const result = await runJvLedgerFxBackfillOnNativeDb(db, { dryRun: false, mode: 'coa' })
    expect(result.candidateRows).toBe(2)
    expect(result.updated).toBe(2)
    expect(db.updates.map((u) => u.filter._id)).toEqual(['journal-1', 'journal-2'])
    expect(db.updates[0].update.$set.currency).toBe('UZS')
    expect(db.updates[0].update.$set.amount).toBeCloseTo(3201.27 * 12100, 2)
  })
})
