import { describe, expect, test } from 'vitest'
import {
  computeMarginMetricsRaw,
  shouldSuppressSpotMetalMtmForCustomerDashboard,
  shouldSuppressSpotMetalMtmForSupplierDashboard,
} from './metalMarginPolicy'

/** Mirrors useErpMarginTabs customer live path: exposureFunds = -outstanding. */
function buildCustomerLiveMetrics(customer, goldPriceUSD, silverPriceUSD) {
  const outstanding = Number(customer?.outstandingBalance || 0)
  const goldPosition = Number(customer?.goldPosition || 0)
  const silverPosition = Number(customer?.silverPosition || 0)
  const accountType = customer?.ledgerAccountId?.accountType
  const suppressMetalSpotMtm = shouldSuppressSpotMetalMtmForCustomerDashboard(accountType)
  const exposureFunds = -outstanding
  const frozenReval = Number(customer?.marginRevaluation ?? 0)
  const frozenEquity = Number(customer?.marginEquity ?? exposureFunds)
  // equity = funds - revaluation ⇒ funds = equity + revaluation
  const totalFunds = frozenEquity + frozenReval
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

describe('useErpMarginTabs customer negated exposure', () => {
  test('margin equity falls when live gold price rises', () => {
    const customer = {
      outstandingBalance: -1000,
      marginEquity: 800,
      marginRevaluation: 200,
      goldPosition: 50,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'asset', accountCode: '2001' },
    }
    const low = buildCustomerLiveMetrics(customer, 128.4, 1.85)
    const high = buildCustomerLiveMetrics(customer, 129.2, 1.85)
    expect(high.revaluation).toBeGreaterThan(low.revaluation)
    expect(high.equity).toBeLessThan(low.equity)
  })

  test('credit ledger outstanding maps to positive equity (Modern Capital–style)', () => {
    const metrics = computeMarginMetricsRaw({
      totalFunds: -(-162131),
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    expect(metrics.equity).toBe(162131)
    expect(metrics.status).toBe('POSITIVE')
  })

  test('debit ledger outstanding maps to negative equity (Aneesh / CEO–style)', () => {
    const cases = [
      { name: 'CEO CURRENT A/C', outstanding: 276.58 },
      { name: 'Aneesh', outstanding: 3411.76 },
      { name: 'BIJU', outstanding: 2764.71 },
      { name: 'Sudheesh', outstanding: 411.76 },
      { name: 'Anil Kumar', outstanding: 176.47 },
      { name: 'Chandran', outstanding: 529.41 },
    ]
    for (const row of cases) {
      const metrics = computeMarginMetricsRaw({
        totalFunds: -row.outstanding,
        goldPosition: 0,
        silverPosition: 0,
        goldPrice: 0,
        silverPrice: 0,
        fundsMode: 'asIs',
      })
      expect(metrics.equity).toBeCloseTo(-row.outstanding, 2)
      expect(metrics.status).toBe('NEGATIVE')
    }
  })

  test('zero balance remains zero equity', () => {
    const metrics = computeMarginMetricsRaw({
      totalFunds: -0,
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    expect(metrics.equity).toBe(0)
    expect(metrics.status).toBe('NEUTRAL')
  })

  test('live path uses negated outstanding without name branching', () => {
    const creditCustomer = buildCustomerLiveMetrics({
      outstandingBalance: -5000,
      marginEquity: 5000,
      marginRevaluation: 0,
      goldPosition: 0,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'asset' },
    }, 0, 0)
    expect(creditCustomer.equity).toBe(5000)

    const debitCustomer = buildCustomerLiveMetrics({
      outstandingBalance: 1234.5,
      marginEquity: -1234.5,
      marginRevaluation: 0,
      goldPosition: 0,
      silverPosition: 0,
      ledgerAccountId: { accountType: 'asset' },
    }, 0, 0)
    expect(debitCustomer.equity).toBeCloseTo(-1234.5, 2)
  })

  test('liability customer live path uses frozen revaluation override', () => {
    const customer = {
      outstandingBalance: -50,
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
    expect(metrics.equity).toBe(-87.5)
    expect(metrics.revaluation).toBe(-12.5)
  })
})
