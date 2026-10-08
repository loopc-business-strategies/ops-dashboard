import { roundMoney } from '../../../utils/money'
import { backendRateToDisplayRate } from './voucherTabShared'

export const SECONDARY_NET_CURRENCY = 'UZS'

const toNumber = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const normalizeCode = (value) => String(value || '').trim().toUpperCase()

/** UZS per 1 base unit from the currency master (stored as base per 1 UZS); 0 when UZS is not configured. */
export function resolveMasterUzsPerBase(currencyOptions = []) {
  const uzs = (currencyOptions || []).find((item) => normalizeCode(item?.code) === SECONDARY_NET_CURRENCY)
  const backendRate = Number(uzs?.exchangeRate || 0)
  if (!Number.isFinite(backendRate) || backendRate <= 0) return 0
  return backendRateToDisplayRate(backendRate, SECONDARY_NET_CURRENCY, true)
}

/**
 * UZS rate for a voucher: a UZS receipt/payment uses its own header rate; any other
 * voucher uses the rate saved with it, falling back to today's master rate.
 */
export function resolveVoucherUzsPerBase({ isReceiptPayment = false, header = {}, masterUzsPerBase = 0 } = {}) {
  if (isReceiptPayment && normalizeCode(header.currCode) === SECONDARY_NET_CURRENCY) {
    const headerRate = toNumber(header.currRate)
    if (headerRate > 0) return headerRate
  }
  const savedRate = toNumber(header.uzsRate)
  if (savedRate > 0) return savedRate
  return toNumber(masterUzsPerBase)
}

/**
 * Voucher net amount in base currency and in UZS.
 * Receipt/payment lines carry their own currency amount (amountFC) and base
 * equivalent (amountLC); other vouchers post their total in base currency.
 */
export function resolveVoucherNetAmounts({
  isReceiptPayment = false,
  lineItems = [],
  grandTotal = 0,
  baseCurrencyCode = 'USD',
  uzsPerBase = 0,
} = {}) {
  const base = normalizeCode(baseCurrencyCode) || 'USD'
  const rate = toNumber(uzsPerBase)
  let baseAmount = 0
  let uzsAmount = 0
  let hasUzsLine = false
  let usesRate = false

  if (isReceiptPayment) {
    for (const line of lineItems || []) {
      const lineBase = toNumber(line?.amountLC) || toNumber(line?.amountWithVAT)
      baseAmount += lineBase
      if (normalizeCode(line?.currCode) === SECONDARY_NET_CURRENCY) {
        hasUzsLine = true
        uzsAmount += toNumber(line?.amountFC)
      } else {
        usesRate = true
        uzsAmount += lineBase * rate
      }
    }
  } else {
    usesRate = true
    baseAmount = toNumber(grandTotal)
    uzsAmount = baseAmount * rate
  }

  const uzsAvailable = base !== SECONDARY_NET_CURRENCY && (rate > 0 || hasUzsLine)
  return {
    baseCurrency: base,
    baseAmount: roundMoney(baseAmount, base),
    uzsAmount: uzsAvailable ? roundMoney(uzsAmount, SECONDARY_NET_CURRENCY) : null,
    uzsPerBase: rate,
    usesRate,
  }
}

/** UZS rate and net amounts for the voucher being edited. */
export function resolveVoucherSummaryNetAmounts({
  isReceiptPayment = false,
  header = {},
  currencyOptions = [],
  lineItems = [],
  grandTotal = 0,
  baseCurrencyCode = 'USD',
} = {}) {
  const uzsPerBase = resolveVoucherUzsPerBase({
    isReceiptPayment,
    header,
    masterUzsPerBase: resolveMasterUzsPerBase(currencyOptions),
  })
  return resolveVoucherNetAmounts({ isReceiptPayment, lineItems, grandTotal, baseCurrencyCode, uzsPerBase })
}

const formatRate = (rate) => Number(rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Amount Summary "Net Amt" rows: base currency and UZS, plus the voucher's own
 * currency when it is neither (e.g. AED).
 */
export function buildNetAmountRows({ voucherCurrency = '', voucherTotal = 0, voucherNetAmounts = null } = {}) {
  const ownCode = normalizeCode(voucherCurrency) || 'USD'
  if (!voucherNetAmounts) return [{ code: ownCode, amount: toNumber(voucherTotal) }]

  const base = voucherNetAmounts.baseCurrency
  const rows = []
  if (ownCode !== base && ownCode !== SECONDARY_NET_CURRENCY) {
    rows.push({ code: ownCode, amount: toNumber(voucherTotal) })
  }
  rows.push({ code: base, amount: voucherNetAmounts.baseAmount })
  if (voucherNetAmounts.uzsAmount != null) {
    const showRate = ownCode !== SECONDARY_NET_CURRENCY
      && voucherNetAmounts.uzsPerBase > 0
      && voucherNetAmounts.usesRate !== false
    rows.push({
      code: SECONDARY_NET_CURRENCY,
      amount: voucherNetAmounts.uzsAmount,
      ...(showRate ? { rateNote: `@ ${formatRate(voucherNetAmounts.uzsPerBase)} ${SECONDARY_NET_CURRENCY}/${base}` } : {}),
    })
  }
  return rows
}
