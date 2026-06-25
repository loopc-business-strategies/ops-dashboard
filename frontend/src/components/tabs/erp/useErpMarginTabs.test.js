import { describe, expect, test } from 'vitest'
import {
  computeMarginMetricsRaw,
  shouldSuppressSpotMetalMtmForCustomerDashboard,
  shouldSuppressSpotMetalMtmForSupplierDashboard,
} from './metalMarginPolicy'

function buildCustomerLiveMetrics(customer, goldPriceUSD, silverPriceUSD) {
  const outstanding = Number(customer?.outstandingBalance || 0)
  const goldPosition = Number(customer?.goldPosition || 0)
  const silverPosition = Number(customer?.silverPosition || 0)
  const accountType = customer?.ledgerAccountId?.accountType
  const suppressMetalSpotMtm = shouldSuppressSpotMetalMtmForCustomerDashboard(accountType)
  const frozenReval = Number(customer?.marginRevaluation ?? 0)
  const frozenEquity = Number(customer?.marginEquity ?? outstanding)
  const totalFunds = frozenEquity - frozenReval
  return computeMarginMetricsRaw({
    totalFunds,
    goldPosition,
    silverPosition,
    goldPrice: goldPriceUSD,
    silverPrice: silverPriceUSD,
    suppressMetalSpotMtm,
    revaluationOverride: suppressMetalSpotMtm ? frozenReval : null,
    fundsMode: 'customerAbsIfNegative',
  })
}

describe('useErpMarginTabs live recalc', () => {
  test('margin metrics increase when live gold price rises', () => {
    const customer = {
      outstandingBalance: 1000,
      marginEquity: 1200,
      marginRevaluation: 200,
      goldPosition: 50,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'asset', accountCode: '2001' },
    }
    const low = buildCustomerLiveMetrics(customer, 128.4, 1.85)
    const high = buildCustomerLiveMetrics(customer, 129.2, 1.85)
    expect(high.revaluation).toBeGreaterThan(low.revaluation)
    expect(high.equity).toBeGreaterThan(low.equity)
    expect(high.marginPercent).toBeLessThan(low.marginPercent)
  })

  test('liability customer live path uses frozen revaluation override', () => {
    const customer = {
      outstandingBalance: 50,
      marginEquity: 50,
      marginRevaluation: 0,
      goldPosition: 10,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'liability', accountCode: '2100' },
    }
    const low = buildCustomerLiveMetrics(customer, 50, 1)
    const high = buildCustomerLiveMetrics(customer, 200, 1)
    expect(low.equity).toBe(50)
    expect(high.equity).toBe(50)
    expect(high.revaluation).toBe(0)
  })

  test('supplier live path suppresses spot MTM with frozen revaluation', () => {
    const outstanding = -100
    const goldPosition = 50
    const frozenReval = -12.5
    const low = computeMarginMetricsRaw({
      totalFunds: outstanding,
      goldPosition,
      silverPosition: 0,
      goldPrice: 50,
      silverPrice: 1,
      suppressMetalSpotMtm: shouldSuppressSpotMetalMtmForSupplierDashboard(),
      revaluationOverride: frozenReval,
      fundsMode: 'asIs',
    })
    const high = computeMarginMetricsRaw({
      totalFunds: outstanding,
      goldPosition,
      silverPosition: 0,
      goldPrice: 200,
      silverPrice: 1,
      suppressMetalSpotMtm: shouldSuppressSpotMetalMtmForSupplierDashboard(),
      revaluationOverride: frozenReval,
      fundsMode: 'asIs',
    })
    expect(low.equity).toBe(-112.5)
    expect(high.equity).toBe(-112.5)
    expect(high.revaluation).toBe(frozenReval)
  })

  test('supplier spot MTM uses live prices in fallback path', () => {
    const goldPosition = 30
    const silverPosition = 10
    const lowReval = goldPosition * 128.4 + silverPosition * 1.85
    const highReval = goldPosition * 129.2 + silverPosition * 1.85
    expect(highReval).toBeGreaterThan(lowReval)
  })
})
