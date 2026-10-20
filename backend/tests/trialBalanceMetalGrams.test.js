const { describe, expect, test } = require('@jest/globals')
const {
  accumulateTrialMetalGrams,
  hasMetalGrams,
  presentMetalGrams,
} = require('../services/erpAccounting/trialBalanceMetalGrams')

describe('trial balance metal grams', () => {
  const accountsById = new Map([
    ['party-1', 'party-1'],
    ['cash-1', 'cash-1'],
  ])
  const accountsByCode = new Map([['1319', 'party-1']])

  test('debits a sale and credits a purchase on the party, split by metal', () => {
    const totals = accumulateTrialMetalGrams([
      {
        type: 'sale',
        date: '2026-10-11T00:00:00.000Z',
        voucherMeta: {
          partyAccountId: 'party-1',
          lineItems: [{ stockCode: 'GOLD', pureWeight: 10 }],
        },
      },
      {
        type: 'purchase',
        date: '2026-10-11T00:00:00.000Z',
        voucherMeta: {
          partyCode: '1319',
          lineItems: [{ stockCode: 'SILVER BAR', pureWeight: 4 }],
        },
      },
      {
        type: 'payment',
        date: '2026-10-12T00:00:00.000Z',
        voucherMeta: {
          partyAccountId: 'cash-1',
          lineItems: [{ stockCode: 'GOLD', pureWeight: 100 }],
        },
      },
    ], { accountsById, accountsByCode, endDate: new Date('2026-10-12T23:59:59.999Z') })

    const party = presentMetalGrams(totals.get('party-1'))
    expect(party.goldDebit).toBe(10)
    expect(party.goldNet).toBe(10)
    expect(party.silverCredit).toBe(4)
    expect(party.silverNet).toBe(-4)
    expect(totals.has('cash-1')).toBe(false)
    expect(hasMetalGrams(party)).toBe(true)
  })

  test('puts grams before the start date into the net only', () => {
    const totals = accumulateTrialMetalGrams([
      {
        type: 'metal_receipt',
        date: '2026-01-02T00:00:00.000Z',
        voucherMeta: {
          partyAccountId: 'party-1',
          lineItems: [{ productType: 'gold', grossWeight: 10, purity: 0.999 }],
        },
      },
    ], {
      accountsById,
      accountsByCode,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-12T23:59:59.999Z'),
    })
    const party = presentMetalGrams(totals.get('party-1'))
    expect(party.goldDebit).toBe(0)
    expect(party.goldCredit).toBe(0)
    expect(party.goldNet).toBeCloseTo(-9.99, 2)
  })

  test('drops a hedged purchase from the gram columns when hedging is excluded', () => {
    const txs = [{
      type: 'purchase',
      date: '2026-10-11T00:00:00.000Z',
      voucherMeta: {
        partyAccountId: 'party-1',
        hedge: true,
        lineItems: [{ stockCode: 'GOLD', pureWeight: 10 }],
      },
    }]
    const kept = accumulateTrialMetalGrams(txs, { accountsById, accountsByCode })
    const dropped = accumulateTrialMetalGrams(txs, { accountsById, accountsByCode, excludeHedging: true })
    expect(presentMetalGrams(kept.get('party-1')).goldNet).toBe(-10)
    expect(dropped.has('party-1')).toBe(false)
  })

  test('created-metal filter keeps only matching metal grams', () => {
    const txs = [
      {
        type: 'sale',
        date: '2026-10-11T00:00:00.000Z',
        voucherMeta: {
          partyAccountId: 'party-1',
          lineItems: [
            { stockCode: 'GOLD', pureWeight: 10 },
            { stockCode: 'SILVER BAR', pureWeight: 4 },
          ],
        },
      },
    ]
    const goldOnly = accumulateTrialMetalGrams(txs, {
      accountsById,
      accountsByCode,
      metalType: 'XAU::stock-gold',
    })
    const party = presentMetalGrams(goldOnly.get('party-1'))
    expect(party.goldDebit).toBe(10)
    expect(party.silverDebit).toBe(0)
    expect(party.silverNet).toBe(0)
  })
})
