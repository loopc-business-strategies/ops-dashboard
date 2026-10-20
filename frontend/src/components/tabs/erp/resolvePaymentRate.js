import { FIXED_AED_RATE, backendRateToDisplayRate } from './voucherUtils'

/**
 * Resolve receipt/payment UI rate (1 USD = FC) from Currency Master.
 * AED is not special-cased to a hardcoded settle rate.
 */
export function resolvePaymentRateFromMaster(currencyCode, {
  currencyOptions = [],
  getBackendRate,
} = {}) {
  const normalized = String(currencyCode || 'USD').trim().toUpperCase()
  if (normalized === 'USD') {
    return { rate: 1, source: 'base_currency' }
  }

  const codes = (currencyOptions || []).map((item) => String(item?.code || '').trim().toUpperCase())
  const hasMasterRow = codes.includes(normalized)
  const backendRate = typeof getBackendRate === 'function'
    ? Number(getBackendRate(normalized))
    : Number((currencyOptions || []).find((item) => String(item?.code || '').trim().toUpperCase() === normalized)?.exchangeRate || 0)

  if (hasMasterRow && Number.isFinite(backendRate) && backendRate > 0) {
    return {
      rate: backendRateToDisplayRate(backendRate, normalized, true),
      source: 'currency_table',
    }
  }

  if (normalized === 'AED') {
    return { rate: FIXED_AED_RATE, source: 'fixed_aed_fallback' }
  }

  return {
    rate: backendRateToDisplayRate(backendRate > 0 ? backendRate : 1, normalized, true),
    source: 'currency_table',
  }
}
