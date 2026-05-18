import { describe, expect, test } from 'vitest'
import {
  buildStatementCurrencyOptions,
  buildStatementMetalOptions,
  calculateAccountSummaryMetrics,
  matchesStatementMetal,
  resolveMetalCodeFromStockName,
  resolveStatementMetalBalance,
  resolveStatementMetalCode,
} from './statementHelpers'

describe('statement helpers', () => {
  test('builds currency options from configured currencies', () => {
    const options = buildStatementCurrencyOptions({
      includeAll: true,
      accountCurrency: 'aed',
      rateCurrency: 'usd',
      baseCurrency: 'USD',
      currencies: [{ code: 'eur' }, { code: 'UZS' }],
    })

    expect(options).toEqual(['ALL', 'AED', 'USD', 'EUR', 'UZS'])
  })

  test('always includes standard and other metal choices', () => {
    const options = buildStatementMetalOptions([
      { mainStock: 'Gold' },
      { mainStock: 'Copper' },
      { mainStock: 'Gold' },
    ])

    expect(options).toEqual(['Gold', 'Copper', 'Silver', 'Platinum', 'Palladium', 'Other'])
  })

  test('matches selected gold, silver, and other metal entries', () => {
    expect(resolveMetalCodeFromStockName('gold')).toBe('XAU')
    expect(resolveMetalCodeFromStockName('Other')).toBe('OTHER')
    expect(resolveStatementMetalCode({ description: 'silver bar sale' })).toBe('XAG')
    expect(matchesStatementMetal({ metalCode: 'XAU' }, 'Gold')).toBe(true)
    expect(matchesStatementMetal({ metalCode: 'XAG' }, 'Gold')).toBe(false)
    expect(matchesStatementMetal({ metalCode: 'COPPER' }, 'Other')).toBe(true)
    expect(matchesStatementMetal({ metalSignedWeight: 2.5 }, 'Other')).toBe(true)
  })

  test('keeps each explicit metal statement selection isolated', () => {
    const rows = [
      { id: 'gold', metalCode: 'XAU' },
      { id: 'silver', metalCode: 'XAG' },
      { id: 'platinum', metalCode: 'XPT' },
      { id: 'palladium', metalCode: 'XPD' },
      { id: 'other', metalCode: 'COPPER' },
    ]

    expect(rows.filter((row) => matchesStatementMetal(row, 'Gold')).map((row) => row.id)).toEqual(['gold'])
    expect(rows.filter((row) => matchesStatementMetal(row, 'Silver')).map((row) => row.id)).toEqual(['silver'])
    expect(rows.filter((row) => matchesStatementMetal(row, 'Platinum')).map((row) => row.id)).toEqual(['platinum'])
    expect(rows.filter((row) => matchesStatementMetal(row, 'Palladium')).map((row) => row.id)).toEqual(['palladium'])
    expect(rows.filter((row) => matchesStatementMetal(row, 'Other')).map((row) => row.id)).toEqual(['other'])
  })

  test('uses account balances for gold/silver and entry movements for other metals', () => {
    const entries = [
      { metalCode: 'XAU', metalSignedWeight: 1 },
      { metalCode: 'XAG', metalSignedWeight: 2 },
      { metalCode: 'COPPER', metalSignedWeight: 3 },
      { metalSignedWeight: -0.5 },
    ]

    expect(resolveStatementMetalBalance({ goldBalance: 12, silverBalance: 8 }, 'XAU', entries)).toBe(12)
    expect(resolveStatementMetalBalance({ goldBalance: 12, silverBalance: 8 }, 'XAG', entries)).toBe(8)
    expect(resolveStatementMetalBalance({}, 'OTHER', entries)).toBe(2.5)
  })

  test('calculates account summary equity from credit exposure magnitude', () => {
    const metrics = calculateAccountSummaryMetrics({
      totalFunds: -112022.75,
      revaluation: 0,
      marginAmount: 0,
    })

    expect(metrics.fundsExposure).toBe(112022.75)
    expect(metrics.netEquity).toBe(112022.75)
    expect(metrics.excess).toBe(112022.75)
    expect(metrics.marginPercent).toBe(0)
  })
})
