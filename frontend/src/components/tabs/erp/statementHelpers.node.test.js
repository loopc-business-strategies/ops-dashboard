import { describe, expect, test } from 'vitest'
import { computeMarginMetricsRaw } from './metalMarginPolicy'
import {
  accumulateUnfixedVoucherRevaluationByMetal,
  buildStatementCurrencyOptions,
  buildStatementMetalOptions,
  calculateAccountSummaryMetrics,
  formatAccountEnquiryExcessDisplay,
  formatMarginExcessDisplay,
  getAccountEnquirySignedMetricColor,
  normalizeAccountEnquiryNetDirection,
  normalizeStatementCurrencyCode,
  resolveExposureDirection,
  resolveUnfixedBookedExposureSign,
  resolveBookedLedgerAmount,
  sortStatementEntriesForExport,
  computeStatementExportOpeningBalances,
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

  test('keeps the all-currencies statement option available for mixed-currency bank accounts', () => {
    const options = buildStatementCurrencyOptions({
      includeAll: true,
      accountCurrency: 'SOMS',
      rateCurrency: 'USD',
      baseCurrency: 'USD',
      currencies: [{ code: 'USD' }, { code: 'UZS' }],
    })

    expect(options[0]).toBe('ALL')
    expect(options).toContain('USD')
    expect(options).toContain('UZS')
    expect(options).not.toContain('SOMS')
    expect(normalizeStatementCurrencyCode('SOMS')).toBe('UZS')
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

  test('calculates account summary equity with signed credit exposure', () => {
    const metrics = calculateAccountSummaryMetrics({
      totalFunds: -112022.75,
      revaluation: 0,
      marginAmount: 0,
    })

    expect(metrics.fundsExposure).toBe(112022.75)
    expect(metrics.netEquity).toBe(-112022.75)
    expect(metrics.excess).toBe(-112022.75)
    expect(metrics.marginPercent).toBe(0)
    expect(resolveExposureDirection(metrics.netEquity)).toBe('Credit')
  })

  test('live enquiry margin metrics move when spot price changes', () => {
    const funds = 1000
    const goldGrams = 50
    const low = computeMarginMetricsRaw({
      totalFunds: funds,
      goldPosition: goldGrams,
      goldPrice: 128.4,
      fundsMode: 'asIs',
    })
    const high = computeMarginMetricsRaw({
      totalFunds: funds,
      goldPosition: goldGrams,
      goldPrice: 129.2,
      fundsMode: 'asIs',
    })
    expect(high.revaluation).toBeGreaterThan(low.revaluation)
    const lowSummary = calculateAccountSummaryMetrics({
      totalFunds: funds,
      revaluation: low.revaluation,
      marginAmount: low.margin,
    })
    const highSummary = calculateAccountSummaryMetrics({
      totalFunds: funds,
      revaluation: high.revaluation,
      marginAmount: high.margin,
    })
    expect(highSummary.netEquity).toBeGreaterThan(lowSummary.netEquity)
    expect(highSummary.excess).toBeGreaterThan(lowSummary.excess)
    expect(highSummary.marginPercent).toBeLessThan(lowSummary.marginPercent)
  })

  test('uses full booked voucher amount for creditor-style revaluation', () => {
    const entries = [{
      metalFixStatus: 'unfixed',
      sourceTransactionType: 'purchase',
      metalDealType: 'purchase',
      unfixedVoucherAmount: 234.21,
      signedAmount: -234.21,
      creditAmount: 234.21,
      metalCode: 'XAU',
      isMetalTrade: true,
    }]

    const byMetal = accumulateUnfixedVoucherRevaluationByMetal(entries, {
      mode: 'booked',
      resolveFixStatus: (entry) => String(entry.metalFixStatus || ''),
      isMetalEntry: () => true,
      resolveMetalCode: resolveStatementMetalCode,
    })

    expect(byMetal.gold).toBe(234.21)
    expect(resolveUnfixedBookedExposureSign(entries[0])).toBe(1)
  })

  test('prefers posted ledger amount over inflated transaction total for booked revaluation', () => {
    const entries = [{
      sourceTransactionId: 'tx-2305',
      metalFixStatus: 'unfixed',
      sourceTransactionType: 'purchase',
      metalDealType: 'purchase',
      unfixedVoucherAmount: 4918.5,
      signedAmount: -234.21,
      creditAmount: 234.21,
      metalCode: 'XAU',
      isMetalTrade: true,
    }]

    expect(resolveBookedLedgerAmount(entries[0])).toBe(234.21)

    const byMetal = accumulateUnfixedVoucherRevaluationByMetal(entries, {
      mode: 'booked',
      resolveFixStatus: (entry) => String(entry.metalFixStatus || ''),
      isMetalEntry: () => true,
      resolveMetalCode: resolveStatementMetalCode,
    })

    expect(byMetal.gold).toBe(234.21)
  })

  test('uses only unpriced voucher remainder for trading-style revaluation', () => {
    const entries = [{
      metalFixStatus: 'unfixed',
      sourceTransactionType: 'purchase',
      metalDealType: 'purchase',
      unfixedVoucherAmount: 234.21,
      signedAmount: -100,
      creditAmount: 100,
      metalCode: 'XAU',
      isMetalTrade: true,
    }]

    const byMetal = accumulateUnfixedVoucherRevaluationByMetal(entries, {
      mode: 'unpriced',
      resolveFixStatus: (entry) => String(entry.metalFixStatus || ''),
      isMetalEntry: () => true,
      resolveMetalCode: resolveStatementMetalCode,
    })

    expect(byMetal.gold).toBe(-134.21)
  })

  test('creditor account summary uses spot revaluation against ledger payable', () => {
    const goldPrice = 144.943
    const xauBalance = 4.9
    const totalFunds = -234.21
    const revaluation = xauBalance * goldPrice
    const marginAmount = Math.abs(revaluation) * 0.02

    const metrics = calculateAccountSummaryMetrics({
      totalFunds,
      revaluation,
      marginAmount,
    })

    expect(metrics.netEquity).toBeCloseTo(-234.21 + revaluation, 2)
    expect(metrics.excess).toBeCloseTo(metrics.netEquity - marginAmount, 2)
    expect(metrics.marginPercent).toBeCloseTo((234.21 / marginAmount) * 100, 1)
  })

  test('formatMarginExcessDisplay shows Short and Excess labels', () => {
    expect(formatMarginExcessDisplay(-4.68, (value) => value.toFixed(2))).toBe('Short 4.68')
    expect(formatMarginExcessDisplay(10, (value) => value.toFixed(2))).toBe('Excess 10.00')
    expect(formatMarginExcessDisplay(0, (value) => value.toFixed(2))).toBe('0.00')
  })

  test('account enquiry excess: zero margin + credit direction avoids misleading Short', () => {
    expect(formatAccountEnquiryExcessDisplay({
      excess: -3314.12,
      marginAmount: 0,
      netDirection: 'Credit',
      formatValue: (v) => v.toFixed(2),
    })).toBe('Favorable 3314.12')
    expect(formatAccountEnquiryExcessDisplay({
      excess: -3314.12,
      marginAmount: 0.02,
      netDirection: 'Credit',
      formatValue: (v) => v.toFixed(2),
    })).toBe('Short 3314.12')
    expect(formatAccountEnquiryExcessDisplay({
      excess: 100,
      marginAmount: 0,
      netDirection: 'Debit',
      formatValue: (v) => v.toFixed(2),
    })).toBe('Excess 100.00')
  })

  test('getAccountEnquirySignedMetricColor favors credit balance when margin is negligible', () => {
    expect(getAccountEnquirySignedMetricColor(-3314, { marginAmount: 0, netDirection: 'Credit' })).toBe('#15803d')
    expect(getAccountEnquirySignedMetricColor(-3314, { marginAmount: 1, netDirection: 'Credit' })).toBe('#c0392b')
    expect(getAccountEnquirySignedMetricColor(3314, { marginAmount: 0, netDirection: 'Debit' })).toBe('#111827')
  })

  test('normalizeAccountEnquiryNetDirection', () => {
    expect(normalizeAccountEnquiryNetDirection('Credit')).toBe('credit')
    expect(normalizeAccountEnquiryNetDirection('Dr')).toBe('debit')
    expect(normalizeAccountEnquiryNetDirection('Flat')).toBe('flat')
  })

  test('export opening USD balance derives from closing minus period movement', () => {
    const entries = [
      {
        sourceTransactionType: 'purchase',
        signedAmount: -234.21,
        creditAmount: 234.21,
        metalSignedWeight: 999.9,
        metalCode: 'XAU',
      },
      {
        sourceTransactionType: 'metal_receipt',
        signedAmount: 0,
        metalSignedWeight: -995,
        metalCode: 'XAU',
      },
    ]

    const balances = computeStatementExportOpeningBalances({
      exportEntries: entries,
      closingNetBalance: -234.21,
      closingPureWeight: 4.9,
      matchesMetalEntry: () => true,
    })

    expect(balances.openingUsdBalance).toBe(0)
    expect(balances.closingUsdBalance).toBe(-234.21)
    expect(balances.openingPureWeight).toBeCloseTo(0, 6)
    expect(balances.closingPureWeight).toBe(4.9)
  })

  test('export sort places purchase before metal receipt on the same date', () => {
    const sorted = sortStatementEntriesForExport([
      { date: '2026-05-26', sourceTransactionType: 'metal_receipt', sourceTransactionNumber: 'MRec/2026/0001' },
      { date: '2026-05-26', sourceTransactionType: 'purchase', sourceTransactionNumber: 'Pur/2026/0001' },
    ], (entry) => String(entry.sourceTransactionNumber || ''))

    expect(sorted[0].sourceTransactionType).toBe('purchase')
    expect(sorted[1].sourceTransactionType).toBe('metal_receipt')
  })
})
