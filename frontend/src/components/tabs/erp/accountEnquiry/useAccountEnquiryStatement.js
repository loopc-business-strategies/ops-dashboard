import { useMemo } from 'react'
import { resolveEffectiveSpotPrices } from '../../../../utils/liveMetalRates'
import { erpTabNeedsLiveMetalRates } from '../erpTabUtils'
import {
  accumulateUnfixedVoucherRevaluationByMetal,
  buildStatementCurrencyOptions,
  buildStatementMetalOptions,
  calculateAccountSummaryMetrics,
  normalizeStatementCurrencyCode,
  matchesStatementMetal,
  resolveMetalCodeFromStockName,
  resolveStatementMetalCode,
  isMetalStatementEntry,
} from '../statementHelpers'
import { shouldSuppressSpotMetalMtmForAccountEnquiry, computeMarginMetricsRaw } from '../metalMarginPolicy'

function resolveFixStatus(entry) {
  const explicit = String(entry?.metalFixStatus || '').trim().toLowerCase()
  if (explicit === 'fixed' || explicit === 'unfixed') return explicit
  const text = `${String(entry?.description || '')} ${String(entry?.referenceType || '')}`.toLowerCase()
  if (/non[\s-_]?fix|unfix|unfixed/.test(text)) return 'unfixed'
  if (/fixing|fixed|price[\s-_]?fix/.test(text)) return 'fixed'
  return 'unknown'
}

function resolveDealSide(entry) {
  const explicit = String(entry?.metalDealType || entry?.sourceTransactionType || '').toLowerCase().trim()
  if (explicit === 'sale' || explicit === 'purchase' || explicit === 'metal_receipt' || explicit === 'metal_payment') return explicit
  const referenceType = String(entry?.referenceType || '').toLowerCase().trim()
  if (referenceType === 'sale' || referenceType === 'purchase' || referenceType === 'metal_receipt' || referenceType === 'metal_payment') return referenceType
  return ''
}

function isLikelyMongoId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim())
}

function resolveStatementReceiptNo(entry = {}) {
  const parsedDocNo = (() => {
    const text = `${String(entry.description || '')} ${String(entry.notes || '')}`
    const match = text.match(/\b((?:Pay|Rec|Pur|Sal|MRec|MPay|BnkJV|JV|Jv)[/-]\d{4}[/-]\d{1,6})\b/i)
    return String(match?.[1] || '').trim()
  })()
  const sourceNo = String(entry.sourceTransactionNumber || '').trim()
  if (sourceNo && !isLikelyMongoId(sourceNo)) return sourceNo
  if (parsedDocNo) return parsedDocNo
  return '-'
}

function combineVoucherStatementRows(entries = []) {
  const grouped = new Map()
  const orderedKeys = []
  entries.forEach((entry, index) => {
    const dealSide = resolveDealSide(entry)
    const sourceId = String(entry?.sourceTransactionId || '').trim()
    const receiptNo = resolveStatementReceiptNo(entry)
    const canGroup = sourceId && ['sale', 'purchase', 'metal_receipt', 'metal_payment'].includes(dealSide)
    const key = canGroup ? `tx:${sourceId}` : `row:${entry?._id || index}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...entry,
        _id: key,
        statementRowIds: [entry?._id].filter(Boolean),
        debitAmount: 0,
        creditAmount: 0,
        signedAmount: 0,
        sourceTransactionType: entry?.sourceTransactionType || dealSide || entry?.referenceType || '',
        metalDealType: entry?.metalDealType || dealSide,
        referenceType: dealSide || entry?.referenceType || '',
        offsetAccountCode: '',
        offsetAccountName: '',
        receiptNo,
        metalSignedWeight: 0,
        unfixedVoucherAmount: 0,
      })
      orderedKeys.push(key)
    }
    const row = grouped.get(key)
    row.debitAmount += Number(entry?.debitAmount || 0)
    row.creditAmount += Number(entry?.creditAmount || 0)
    row.signedAmount += Number(entry?.signedAmount || 0)
    row.statementRowIds = Array.from(new Set([...(row.statementRowIds || []), entry?._id].filter(Boolean)))
    const incomingVoucherAmount = Number(entry?.unfixedVoucherAmount || 0)
    if (Number.isFinite(incomingVoucherAmount) && Math.abs(incomingVoucherAmount) > Math.abs(Number(row.unfixedVoucherAmount || 0))) {
      row.unfixedVoucherAmount = incomingVoucherAmount
    }
    const entryType = String(entry?.referenceType || '').toLowerCase()
    if (entryType === dealSide || (!row.offsetAccountCode && entry?.offsetAccountCode)) {
      row.offsetAccountCode = entry?.offsetAccountCode || row.offsetAccountCode
      row.offsetAccountName = entry?.offsetAccountName || row.offsetAccountName
    }
    if (!row.sourceTransactionNumber && entry?.sourceTransactionNumber) row.sourceTransactionNumber = entry.sourceTransactionNumber
    if (!row.metalFixStatus && entry?.metalFixStatus) row.metalFixStatus = entry.metalFixStatus
    if (!row.metalCode && entry?.metalCode) row.metalCode = entry.metalCode
    if (!row.isMetalTrade && entry?.isMetalTrade) row.isMetalTrade = entry.isMetalTrade
    const incomingMetalW = Number(entry?.metalSignedWeight || 0)
    if (Number.isFinite(incomingMetalW) && incomingMetalW !== 0) {
      const cur = Number(row.metalSignedWeight || 0)
      if (!cur) {
        row.metalSignedWeight = incomingMetalW
      } else {
        const maxAbs = Math.max(Math.abs(cur), Math.abs(incomingMetalW))
        const sameWithinGram = maxAbs > 0 && (Math.abs(cur - incomingMetalW) / maxAbs) < 1e-5
        if (!sameWithinGram) {
          row.metalSignedWeight = cur + incomingMetalW
        }
      }
    }
  })
  return orderedKeys.map((key) => {
    const row = grouped.get(key)
    row.debitAmount = Number(row.debitAmount.toFixed(2))
    row.creditAmount = Number(row.creditAmount.toFixed(2))
    row.signedAmount = Number(row.signedAmount.toFixed(2))
    row.unfixedVoucherAmount = Number(Number(row.unfixedVoucherAmount || 0).toFixed(2))
    return row
  })
}

function deriveStatementUnfixedMetalBalances(entries) {
  return entries.reduce((acc, entry) => {
    if (resolveFixStatus(entry) !== 'unfixed') return acc
    if (!isMetalStatementEntry(entry)) return acc
    const w = Number(entry.metalSignedWeight || 0)
    if (!Number.isFinite(w) || w === 0) return acc
    const mc = resolveStatementMetalCode(entry)
    if (mc === 'XAG') acc.silver += w
    else if (mc && mc !== '-') acc.gold += w
    return acc
  }, { gold: 0, silver: 0 })
}

function buildPureWeightRunningBalancesByEntryKey(entries, selectedMetalCode) {
  const selected = String(selectedMetalCode || '').trim().toUpperCase()
  const isMetalRowForPureWt = (entry) => isMetalStatementEntry(entry) && resolveStatementMetalCode(entry) === selected
  let closing = entries.reduce((sum, entry) => {
    if (!isMetalRowForPureWt(entry)) return sum
    return sum + Number(entry.metalSignedWeight || 0)
  }, 0)
  const map = new Map()
  for (const entry of entries) {
    if (!isMetalRowForPureWt(entry)) continue
    map.set(entry._id, closing)
    closing -= Number(entry.metalSignedWeight || 0)
  }
  return map
}

function summarizeMetalDealRows(rows) {
  return rows.reduce((acc, row) => {
    if (row.dealSide === 'sale') {
      acc.saleCount += 1
      acc.saleAmount += row.amount
    }
    if (row.dealSide === 'purchase') {
      acc.purchaseCount += 1
      acc.purchaseAmount += row.amount
    }
    return acc
  }, {
    saleCount: 0,
    purchaseCount: 0,
    saleAmount: 0,
    purchaseAmount: 0,
  })
}

const STRICT_CASH_STATEMENT_TYPES = new Set([
  'payment',
  'receipt',
  'sale',
  'purchase',
  'jv',
  'bank_jv',
  'bank-jv',
])

/**
 * Statement merge, MTM/revaluation, and display helpers for account enquiry.
 */
export function useAccountEnquiryStatement({
  activeTab,
  showEnquiryModal,
  accountEnquiryData,
  statementFilters,
  statementMetalCommodityEnabled,
  erpLiveMetalSnapshot,
  metalRates,
  erpBaseCurrencyCode,
  currencies,
  inventoryStockTypeOptions,
  convertJvAmount,
}) {
  const enquiryComputationEnabled = activeTab === 'enquiry' || showEnquiryModal
  const rawStatementEntries = enquiryComputationEnabled ? (accountEnquiryData?.statement?.entries || []) : []
  const needsLiveMetalForRender = enquiryComputationEnabled || erpTabNeedsLiveMetalRates(activeTab)

  const effectiveSpotPrices = useMemo(() => resolveEffectiveSpotPrices({
    liveSnapshot: needsLiveMetalForRender ? erpLiveMetalSnapshot : null,
    enquiryGold: enquiryComputationEnabled ? accountEnquiryData?.metals?.goldPrice : 0,
    enquirySilver: enquiryComputationEnabled ? accountEnquiryData?.metals?.silverPrice : 0,
    fallbackGold: metalRates.goldPrice,
    fallbackSilver: metalRates.silverPrice,
  }), [
    needsLiveMetalForRender,
    erpLiveMetalSnapshot,
    enquiryComputationEnabled,
    accountEnquiryData?.metals?.goldPrice,
    accountEnquiryData?.metals?.silverPrice,
    metalRates.goldPrice,
    metalRates.silverPrice,
  ])

  const goldPriceUSD = effectiveSpotPrices.goldPriceUSD
  const silverPriceUSD = effectiveSpotPrices.silverPriceUSD
  const enquiryLiveRecalcEnabled = enquiryComputationEnabled && (goldPriceUSD > 0 || silverPriceUSD > 0)

  const totalFunds = accountEnquiryData ? Number(accountEnquiryData.balances?.netBalance || 0) : 0
  const modalStatementCurrency = erpBaseCurrencyCode
  const rawUnfixedMetalDedupeKeys = new Set()
  const rawUnfixedStatementMetalHint = rawStatementEntries.reduce((acc, entry) => {
    if (resolveFixStatus(entry) !== 'unfixed') return acc
    if (!isMetalStatementEntry(entry)) return acc
    const w = Number(entry.metalSignedWeight || 0)
    if (!Number.isFinite(w) || w === 0) return acc
    const tx = String(entry?.sourceTransactionId || '').trim()
    if (tx) {
      const dedupeKey = `${tx}:${Math.round(w * 1e6)}`
      if (rawUnfixedMetalDedupeKeys.has(dedupeKey)) return acc
      rawUnfixedMetalDedupeKeys.add(dedupeKey)
    }
    const mc = resolveStatementMetalCode(entry)
    if (mc === 'XAG') acc.silver += w
    else if (mc && mc !== '-') acc.gold += w
    return acc
  }, { gold: 0, silver: 0 })

  const resolvePreferredStatementMetalCode = (entries = [], hint = { gold: 0, silver: 0 }) => {
    const explicitMetal = entries.find((entry) => {
      const metalCode = String(entry?.metalCode || '').trim().toUpperCase()
      return metalCode === 'XAU' || metalCode === 'XAG'
    })
    if (explicitMetal?.metalCode) return String(explicitMetal.metalCode).trim().toUpperCase()
    const goldAbs = Math.abs(Number(accountEnquiryData?.metals?.goldBalance || 0)) || Math.abs(hint.gold || 0)
    const silverAbs = Math.abs(Number(accountEnquiryData?.metals?.silverBalance || 0)) || Math.abs(hint.silver || 0)
    return silverAbs > goldAbs ? 'XAG' : 'XAU'
  }

  const defaultStatementMetalCode = resolvePreferredStatementMetalCode(rawStatementEntries, rawUnfixedStatementMetalHint)
  const statementSelectedMetalCode = statementFilters.metalCommodity
    ? resolveMetalCodeFromStockName(statementFilters.metalCommodity)
    : defaultStatementMetalCode
  const statementDisplayCurrency = normalizeStatementCurrencyCode(
    statementFilters.showAmountIn
    || accountEnquiryData?.balances?.rateCurrency
    || accountEnquiryData?.account?.currency
    || modalStatementCurrency,
  ).trim().toUpperCase()
  const baseCurrencyCode = erpBaseCurrencyCode
  const statementFilterCurrencyOptions = buildStatementCurrencyOptions({
    includeAll: true,
    currencies,
    accountCurrency: accountEnquiryData?.account?.currency,
    rateCurrency: accountEnquiryData?.balances?.rateCurrency,
    baseCurrency: baseCurrencyCode,
    modalCurrency: modalStatementCurrency,
  })
  const statementDisplayCurrencyOptions = buildStatementCurrencyOptions({
    includeAll: false,
    currencies,
    accountCurrency: accountEnquiryData?.account?.currency,
    rateCurrency: accountEnquiryData?.balances?.rateCurrency,
    baseCurrency: baseCurrencyCode,
    modalCurrency: modalStatementCurrency,
  })
  const statementMetalOptions = buildStatementMetalOptions(inventoryStockTypeOptions)

  const convertStatementDisplayAmount = (value) => {
    const numeric = Number(value || 0)
    if (!Number.isFinite(numeric)) return 0
    const converted = convertJvAmount(numeric, modalStatementCurrency, statementDisplayCurrency)
    return Number.isFinite(converted) ? converted : numeric
  }

  const spotMetalQuoteCurrency = normalizeStatementCurrencyCode(
    accountEnquiryData?.metals?.priceCurrency || 'USD',
  ).trim().toUpperCase()

  const convertMetalSpotDisplayAmount = (value) => {
    const numeric = Number(value || 0)
    if (!Number.isFinite(numeric)) return 0
    const converted = convertJvAmount(numeric, spotMetalQuoteCurrency, statementDisplayCurrency)
    return Number.isFinite(converted) ? converted : numeric
  }

  const formatStatementValue = (value, digits = 2) => {
    const num = Number(value || 0)
    return num.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  }

  const formatStatementNullableValue = (value, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
    return formatStatementValue(value, digits)
  }

  const getSignedColor = (value) => {
    const num = Number(value || 0)
    return num >= 0 ? '#111827' : '#c0392b'
  }

  const isCashOnHandEnquiry = String(accountEnquiryData?.account?.accountCode || '').trim() === '1000'
  const resolveMetalCode = resolveStatementMetalCode

  const statementEntries = combineVoucherStatementRows(rawStatementEntries)
  {
    const sortStatementNewestFirst = (left, right) => {
      const leftDate = new Date(left?.date || 0).getTime()
      const rightDate = new Date(right?.date || 0).getTime()
      if (rightDate !== leftDate) return rightDate - leftDate
      return String(right?._id || '').localeCompare(String(left?._id || ''))
    }
    const sorted = [...statementEntries].sort(sortStatementNewestFirst)
    let rb = Number(accountEnquiryData?.balances?.netBalance ?? 0)
    if (!Number.isFinite(rb)) rb = 0
    for (const row of sorted) {
      row.runningBalance = rb
      rb -= Number(row?.signedAmount || 0)
    }
  }

  const statementUnfixedMetalBalances = deriveStatementUnfixedMetalBalances(statementEntries)
  const apiGoldBal = accountEnquiryData ? Number(accountEnquiryData.metals?.goldBalance || 0) : 0
  const apiSilverBal = accountEnquiryData ? Number(accountEnquiryData.metals?.silverBalance || 0) : 0
  const xauBalance = apiGoldBal !== 0 ? apiGoldBal : statementUnfixedMetalBalances.gold
  const xagBalance = apiSilverBal !== 0 ? apiSilverBal : statementUnfixedMetalBalances.silver
  const modalTotalFunds = totalFunds

  const enquirySuppressMetalSpotMtm = Boolean(
    accountEnquiryData?.metals?.suppressMetalSpotMtm
      || (accountEnquiryData && shouldSuppressSpotMetalMtmForAccountEnquiry(accountEnquiryData.account)),
  )

  const statementUnfixedVoucherRevaluationByMetal = accumulateUnfixedVoucherRevaluationByMetal(statementEntries, {
    mode: enquirySuppressMetalSpotMtm ? 'booked' : 'unpriced',
    resolveFixStatus,
    isMetalEntry: isMetalStatementEntry,
    resolveMetalCode: resolveStatementMetalCode,
  })

  const statementUnfixedVoucherRevaluation =
    statementUnfixedVoucherRevaluationByMetal.gold
    + statementUnfixedVoucherRevaluationByMetal.silver
    + statementUnfixedVoucherRevaluationByMetal.other

  const useVoucherRevaluation = !enquirySuppressMetalSpotMtm
    && !enquiryLiveRecalcEnabled
    && Math.abs(statementUnfixedVoucherRevaluation) > 0.000001

  const enquiryUseLiveSpotMtm = enquiryLiveRecalcEnabled && Boolean(accountEnquiryData)
  const xauSpotValue = xauBalance * goldPriceUSD
  const xagSpotValue = xagBalance * silverPriceUSD

  let xauCurrentValue
  let xagCurrentValue
  let modalRevaluation
  if (enquirySuppressMetalSpotMtm) {
    xauCurrentValue = xauSpotValue
    xagCurrentValue = xagSpotValue
    modalRevaluation = xauSpotValue + xagSpotValue
  } else {
    xauCurrentValue = useVoucherRevaluation
      ? statementUnfixedVoucherRevaluationByMetal.gold
      : xauSpotValue
    xagCurrentValue = useVoucherRevaluation
      ? statementUnfixedVoucherRevaluationByMetal.silver
      : xagSpotValue
    modalRevaluation = useVoucherRevaluation
      ? statementUnfixedVoucherRevaluation
      : (xauCurrentValue + xagCurrentValue)
  }

  const modalMarginAmt = Math.abs(modalRevaluation) * 0.02

  const resolvePayableBreakEvenPrice = (metalBalance) => {
    const grams = Math.abs(Number(metalBalance || 0))
    if (grams <= 0) return 0
    return Math.abs(totalFunds) / grams
  }

  const breakEvenPrice = resolvePayableBreakEvenPrice(xauBalance)

  const displayModalPositionCurrentValue = (spotBasedValue, bookedValue) => {
    if (enquiryUseLiveSpotMtm || enquirySuppressMetalSpotMtm || !useVoucherRevaluation) {
      return convertMetalSpotDisplayAmount(spotBasedValue)
    }
    return convertStatementDisplayAmount(bookedValue)
  }

  const modalPositionRows = enquiryComputationEnabled && accountEnquiryData ? [
    {
      key: 'xau',
      type: 'XAU',
      limits: 0,
      balance: xauBalance,
      price: convertMetalSpotDisplayAmount(goldPriceUSD),
      currentValue: displayModalPositionCurrentValue(xauSpotValue, statementUnfixedVoucherRevaluationByMetal.gold),
      breakEven: convertStatementDisplayAmount(breakEvenPrice),
    },
    {
      key: 'xag',
      type: 'XAG',
      limits: 0,
      balance: xagBalance,
      price: convertMetalSpotDisplayAmount(silverPriceUSD),
      currentValue: displayModalPositionCurrentValue(xagSpotValue, statementUnfixedVoucherRevaluationByMetal.silver),
      breakEven: convertStatementDisplayAmount(resolvePayableBreakEvenPrice(xagBalance)),
    },
  ] : []

  const pureWeightRunningByEntryKey = buildPureWeightRunningBalancesByEntryKey(statementEntries, statementSelectedMetalCode)
  const statementReferenceTypes = Array.from(new Set(statementEntries.map((entry) => String(entry.referenceType || '').trim()).filter(Boolean))).sort()
  const statementDepartments = Array.from(new Set(statementEntries.map((entry) => String(entry.department || '').trim()).filter(Boolean))).sort()

  const filteredStatementEntries = statementEntries.filter((entry) => {
    if (isCashOnHandEnquiry) {
      const sourceType = String(entry?.sourceTransactionType || '').toLowerCase().trim()
      const referenceType = String(entry?.referenceType || '').toLowerCase().trim()
      const effectiveType = sourceType || referenceType
      if (!STRICT_CASH_STATEMENT_TYPES.has(effectiveType)) return false
    }
    const entryDate = entry.date ? new Date(entry.date) : null
    if (statementFilters.startDate) {
      const start = new Date(statementFilters.startDate)
      if (!entryDate || entryDate < start) return false
    }
    if (statementFilters.endDate) {
      const end = new Date(statementFilters.endDate)
      end.setHours(23, 59, 59, 999)
      if (!entryDate || entryDate > end) return false
    }
    if (statementFilters.referenceType && String(entry.referenceType || '') !== statementFilters.referenceType) return false
    if (statementFilters.department && String(entry.department || '') !== statementFilters.department) return false
    if (statementFilters.fixStatus) {
      const fixStatus = resolveFixStatus(entry)
      if (statementFilters.fixStatus === 'fixed' && fixStatus !== 'fixed') return false
      if (statementFilters.fixStatus === 'unfixed' && fixStatus !== 'unfixed') return false
      if (statementFilters.fixStatus === 'unknown' && fixStatus !== 'unknown') return false
    }
    if (statementFilters.foreignCurrency) {
      const entryCurrency = normalizeStatementCurrencyCode(entry.currency)
      const selectedCurrency = normalizeStatementCurrencyCode(statementFilters.foreignCurrency)
      if (entryCurrency !== selectedCurrency) return false
    }
    if (statementMetalCommodityEnabled && statementFilters.metalCommodity) {
      if (!matchesStatementMetal(entry, statementFilters.metalCommodity)) return false
    }
    return true
  })

  const visibleStatementNetBalance = filteredStatementEntries.reduce((sum, entry) => {
    return sum + Number(entry?.signedAmount || 0)
  }, 0)

  const modalTotalFundsDisplay = isCashOnHandEnquiry ? visibleStatementNetBalance : modalTotalFunds

  const enquiryLiveMetrics = enquiryUseLiveSpotMtm
    ? computeMarginMetricsRaw({
      totalFunds: modalTotalFundsDisplay,
      goldPosition: xauBalance,
      silverPosition: xagBalance,
      goldPrice: goldPriceUSD,
      silverPrice: silverPriceUSD,
      fundsMode: 'asIs',
    })
    : null

  const modalRevaluationDisplay = enquiryLiveMetrics
    ? enquiryLiveMetrics.revaluation
    : modalRevaluation
  const modalMarginAmtDisplay = enquiryLiveMetrics
    ? enquiryLiveMetrics.margin
    : modalMarginAmt

  const modalDisplayMetrics = calculateAccountSummaryMetrics({
    totalFunds: modalTotalFundsDisplay,
    revaluation: modalRevaluationDisplay,
    marginAmount: modalMarginAmtDisplay,
  })

  const modalNetEquityDisplay = modalDisplayMetrics.netEquity
  const modalExcessDisplay = modalDisplayMetrics.excess
  const modalMarginPctDisplay = modalDisplayMetrics.marginPercent

  const metalFixingEntries = filteredStatementEntries
    .map((entry) => {
      const dealSide = resolveDealSide(entry)
      if (dealSide !== 'sale' && dealSide !== 'purchase') return null
      const isExplicitMetalTrade = Boolean(entry?.isMetalTrade)
      const hasLegacyMetalHint = String(entry?.metalCode || '').trim() !== '' || /\bxau\b|\bxag\b|gold|silver/i.test(String(entry?.description || ''))
      if (!isExplicitMetalTrade && !hasLegacyMetalHint) return null
      const amount = Math.abs(Number(entry?.signedAmount ?? entry?.debitAmount ?? entry?.creditAmount ?? 0))
      return {
        ...entry,
        dealSide,
        fixStatus: resolveFixStatus(entry),
        metalCode: resolveMetalCode(entry),
        amount,
      }
    })
    .filter(Boolean)

  const fixedMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'fixed')
  const unfixedMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'unfixed')
  const unknownFixMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'unknown')
  const fixedMetalSummary = summarizeMetalDealRows(fixedMetalEntries)
  const unfixedMetalSummary = summarizeMetalDealRows(unfixedMetalEntries)

  const formatStatementDate = (value) => {
    if (!value) return '-'
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return '-'
    return dt.toLocaleDateString()
  }

  const recentPaymentReceiptEntry = [...rawStatementEntries]
    .filter((entry) => {
      const type = String(entry.referenceType || '').toLowerCase()
      return type === 'payment' || type === 'receipt'
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null

  return {
    goldPriceUSD,
    silverPriceUSD,
    rawStatementEntries,
    baseCurrencyCode,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    statementFilterCurrencyOptions,
    statementDisplayCurrencyOptions,
    statementMetalOptions,
    statementReferenceTypes,
    statementDepartments,
    filteredStatementEntries,
    modalPositionRows,
    formatStatementValue,
    formatStatementNullableValue,
    getSignedColor,
    convertStatementDisplayAmount,
    resolveStatementReceiptNo,
    resolveMetalCode,
    pureWeightRunningByEntryKey,
    formatStatementDate,
    recentPaymentReceiptEntry,
    unfixedMetalEntries,
    fixedMetalSummary,
    unfixedMetalSummary,
    unknownFixMetalEntries,
    modalTotalFundsDisplay,
    modalRevaluationDisplay,
    modalNetEquityDisplay,
    modalMarginAmtDisplay,
    modalExcessDisplay,
    modalMarginPctDisplay,
    enquirySuppressMetalSpotMtm,
  }
}
