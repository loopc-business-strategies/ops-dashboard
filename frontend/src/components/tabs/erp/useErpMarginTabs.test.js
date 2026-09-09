import { describe, expect, test } from 'vitest'
import {
  computeMarginMetricsRaw,
  shouldSuppressSpotMetalMtmForCustomerDashboard,
  shouldSuppressSpotMetalMtmForSupplierDashboard,
} from './metalMarginPolicy'

/** Mirrors useErpMarginTabs customer live path after signed-exposure fix. */
function buildCustomerLiveMetrics(customer, goldPriceUSD, silverPriceUSD) {
  const outstanding = Number(customer?.outstandingBalance || 0)
  const goldPosition = Number(customer?.goldPosition || 0)
  const silverPosition = Number(customer?.silverPosition || 0)
  const accountType = customer?.ledgerAccountId?.accountType
  const suppressMetalSpotMtm = shouldSuppressSpotMetalMtmForCustomerDashboard(accountType)
  const exposureFunds = outstanding
  const frozenReval = Number(customer?.marginRevaluation ?? 0)
  const frozenEquity = Number(customer?.marginEquity ?? exposureFunds)
  const totalFunds = frozenEquity - frozenReval
  return computeMarginMetricsRaw({
    totalFunds,
    goldPosition,
    silverPosition,
    goldPrice: goldPriceUSD,
    silverPrice: silverPriceUSD,
    suppressMetalSpotMtm,
    revaluationOverride: suppressMetalSpotMtm ? frozenReval : null,
    fundsMode: 'asIs',
  })
}

/** Supplier path still forces non-positive payable funds via -abs. */
function buildSupplierLiveMetrics(vendor, goldPriceUSD, silverPriceUSD) {
  const outstanding = -Math.abs(Number(vendor?.outstanding ?? vendor?.outstandingBalance ?? 0))
  const goldPosition = Number(vendor?.goldPosition || 0)
  const silverPosition = Number(vendor?.silverPosition || 0)
  const frozenReval = Number(vendor?.marginRevaluation ?? 0)
  return computeMarginMetricsRaw({
    totalFunds: outstanding,
    goldPosition,
    silverPosition,
    goldPrice: goldPriceUSD,
    silverPrice: silverPriceUSD,
    suppressMetalSpotMtm: shouldSuppressSpotMetalMtmForSupplierDashboard(),
    revaluationOverride: frozenReval,
    fundsMode: 'asIs',
  })
}

describe('useErpMarginTabs customer signed exposure', () => {
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

  test('positive signed ledger net stays positive equity (Modern Capital–style fixture)', () => {
    const metrics = computeMarginMetricsRaw({
      totalFunds: 162131,
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    expect(metrics.equity).toBe(162131)
    expect(metrics.status).toBe('POSITIVE')
  })

  test('negative signed ledger net stays negative equity (Aneesh / CEO–style fixtures)', () => {
    const cases = [
      { name: 'CEO CURRENT A/C', outstanding: -276.58 },
      { name: 'Aneesh', outstanding: -3411.76 },
      { name: 'BIJU', outstanding: -2764.71 },
      { name: 'Sudheesh', outstanding: -411.76 },
      { name: 'Anil Kumar', outstanding: -176.47 },
      { name: 'Chandran', outstanding: -529.41 },
    ]
    for (const row of cases) {
      const metrics = computeMarginMetricsRaw({
        totalFunds: row.outstanding,
        goldPosition: 0,
        silverPosition: 0,
        goldPrice: 0,
        silverPrice: 0,
        fundsMode: 'asIs',
      })
      expect(metrics.equity, row.name).toBeCloseTo(row.outstanding, 2)
      expect(metrics.status, row.name).toBe('NEGATIVE')
    }
  })

  test('zero balance remains zero equity', () => {
    const metrics = computeMarginMetricsRaw({
      totalFunds: 0,
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    expect(metrics.equity).toBe(0)
    expect(metrics.status).toBe('NEUTRAL')
  })

  test('genuinely positive exposure remains positive without name branching', () => {
    const live = buildCustomerLiveMetrics({
      outstandingBalance: 5000,
      marginEquity: 5000,
      marginRevaluation: 0,
      goldPosition: 0,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'asset' },
    }, 0, 0)
    expect(live.equity).toBe(5000)
    expect(live.status).toBe('POSITIVE')
  })

  test('genuinely negative exposure remains negative without name branching', () => {
    const live = buildCustomerLiveMetrics({
      outstandingBalance: -1234.5,
      marginEquity: -1234.5,
      marginRevaluation: 0,
      goldPosition: 0,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'asset' },
    }, 0, 0)
    expect(live.equity).toBeCloseTo(-1234.5, 2)
    expect(live.status).toBe('NEGATIVE')
  })

  test('metal revaluation still adds to signed funds', () => {
    const metrics = computeMarginMetricsRaw({
      totalFunds: 1000,
      goldPosition: 10,
      silverPosition: 0,
      goldPrice: 50,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    expect(metrics.revaluation).toBe(500)
    expect(metrics.equity).toBe(1500)
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

  test('supplier live path still uses -abs payable funds and is unchanged', () => {
    const vendor = {
      outstanding: 100,
      marginRevaluation: -12.5,
      goldPosition: 50,
      silverPosition: 0,
    }
    const metrics = buildSupplierLiveMetrics(vendor, 200, 1)
    expect(metrics.funds).toBe(-100)
    expect(metrics.equity).toBe(-112.5)
    expect(metrics.revaluation).toBe(-12.5)
  })
})
