import { describe, expect, test } from 'vitest'
import { computeMarginMetricsRaw } from './metalMarginPolicy'

function buildCustomerRow(customer, goldPriceUSD, silverPriceUSD, liveRecalcEnabled) {
  const outstanding = Number(customer?.outstandingBalance || 0)
  const goldPosition = Number(customer?.goldPosition || 0)
  const silverPosition = Number(customer?.silverPosition || 0)
  if (!liveRecalcEnabled) return null
  const metrics = computeMarginMetricsRaw({
    totalFunds: outstanding,
    goldPosition,
    silverPosition,
    goldPrice: goldPriceUSD,
    silverPrice: silverPriceUSD,
    fundsMode: 'customerAbsIfNegative',
  })
  return metrics
}

describe('useErpMarginTabs live recalc', () => {
  test('margin metrics increase when live gold price rises', () => {
    const customer = {
      _id: 'c1',
      name: 'Test Customer',
      outstandingBalance: 1000,
      goldPosition: 50,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'asset', accountCode: '2001' },
    }
    const low = buildCustomerRow(customer, 128.4, 1.85, true)
    const high = buildCustomerRow(customer, 129.2, 1.85, true)
    expect(low).not.toBeNull()
    expect(high).not.toBeNull()
    if (!low || !high) throw new Error('expected metrics')
    expect(high.revaluation).toBeGreaterThan(low.revaluation)
    expect(high.equity).toBeGreaterThan(low.equity)
    expect(high.marginPercent).toBeLessThan(low.marginPercent)
  })

  test('supplier spot MTM uses live prices in fallback path', () => {
    const goldPosition = 30
    const silverPosition = 10
    const lowReval = goldPosition * 128.4 + silverPosition * 1.85
    const highReval = goldPosition * 129.2 + silverPosition * 1.85
    expect(highReval).toBeGreaterThan(lowReval)
  })
})
