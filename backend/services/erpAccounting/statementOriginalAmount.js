const ORIGINAL_AMOUNT_MATCH_TOLERANCE = 0.01

const normalizeCode = (value, fallback = '') => String(value || fallback).trim().toUpperCase()
const roundOriginalAmount = (value) => Math.round(Number(value || 0) * 100) / 100

const isMainVoucherPosting = (entry = {}, transaction = {}) => {
  const entryId = String(entry._id || '')
  if (entryId && String(transaction.journalEntryId || '') === entryId) return true
  return String(entry.referenceId || '') === String(transaction._id || '')
    && String(entry.referenceType || '').trim().toLowerCase() === String(transaction.type || '').trim().toLowerCase()
}

/**
 * Amount and currency a statement ledger row was entered in.
 * Voucher main postings are stored in base currency (exchangeRate 1), so the
 * voucher's own amount and rate are needed to recover e.g. the UZS figure.
 */
function resolveStatementRowOriginalAmount({ entry = {}, transaction = null, baseCurrencyCode = 'USD' } = {}) {
  const base = normalizeCode(baseCurrencyCode, 'USD')
  const entryCurrency = normalizeCode(entry.currency, base)
  const entryAmount = Math.abs(Number(entry.amount || 0))
  if (entryCurrency !== base) {
    return { originalCurrency: entryCurrency, originalAmount: entryAmount }
  }

  const entryRate = Number(entry.exchangeRate || 1)
  const baseAmount = entryAmount * (entryRate > 0 ? entryRate : 1)
  const baseResult = { originalCurrency: base, originalAmount: roundOriginalAmount(baseAmount) }
  if (!transaction || !isMainVoucherPosting(entry, transaction)) return baseResult

  const txCurrency = normalizeCode(transaction.currency, base)
  const txRate = Number(transaction.exchangeRate)
  if (txCurrency === base || !Number.isFinite(txRate) || txRate <= 0) return baseResult

  const txAmount = Math.abs(Number(transaction.amount || 0))
  if (Math.abs(baseAmount - txAmount * txRate) <= ORIGINAL_AMOUNT_MATCH_TOLERANCE) {
    return { originalCurrency: txCurrency, originalAmount: txAmount }
  }
  // Net-of-VAT postings are a part of the voucher total; never more than it.
  const impliedAmount = baseAmount / txRate
  if (impliedAmount > txAmount + ORIGINAL_AMOUNT_MATCH_TOLERANCE) return baseResult
  return { originalCurrency: txCurrency, originalAmount: roundOriginalAmount(impliedAmount) }
}

module.exports = {
  resolveStatementRowOriginalAmount,
}
