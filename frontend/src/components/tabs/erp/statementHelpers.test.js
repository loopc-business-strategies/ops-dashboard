import { describe, expect, test } from 'vitest'
import {
  buildStatementCurrencyOptions,
  buildStatementMetalOptions,
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
})
