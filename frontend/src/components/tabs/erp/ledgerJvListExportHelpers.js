import { formatAmount, formatMoney } from '../../../utils/money'
import { normalizeJvCurrencyCode } from './journalVoucherHelpers'

function formatJvDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString()
}

function formatJvAmountText(voucher = {}, baseCurrencyCode = 'USD') {
  const baseSym = String(baseCurrencyCode || '').trim().toUpperCase() || 'USD'
  const baseEq = Number(voucher?.totalBaseAmount || 0)
  const isJournalJv = String(voucher?.referenceType || '').toLowerCase() === 'journal'

  if (isJournalJv) {
    const baseText = `${formatAmount(baseEq, { currencyCode: baseSym })} ${baseSym}`
    if (voucher?.documentFaceAmount != null && voucher?.documentCurrencyCode) {
      return `${baseText}\n(~ ${formatMoney(voucher.documentFaceAmount, voucher.documentCurrencyCode)})`
    }
    return baseText
  }

  let displayAmt = baseEq
  let displaySym = baseSym
  if (voucher?.documentFaceAmount != null && voucher?.documentCurrencyCode) {
    displaySym = normalizeJvCurrencyCode(voucher.documentCurrencyCode)
    displayAmt = voucher.documentFaceAmount
  }
  const primary = `${formatAmount(displayAmt, { currencyCode: displaySym })}${displaySym ? ` ${displaySym}` : ''}`
  const isFc = displaySym && normalizeJvCurrencyCode(displaySym) !== baseSym
  return isFc ? `${primary}\n(~ ${formatMoney(baseEq, baseSym)})` : primary
}

function formatJvTypeText(voucher = {}) {
  const isBankJv = String(voucher?.referenceType || '').toLowerCase() === 'bank_jv'
  const parts = [isBankJv ? 'Bank JV' : (voucher?.referenceType || 'journal')]
  if (voucher?.lineCount > 1) parts.push(`${voucher.lineCount} lines`)
  if (isBankJv && voucher?.autoTxNo) parts.push(voucher.autoTxNo)
  if (isBankJv && voucher?.chequeNo) parts.push(`Chq: ${voucher.chequeNo}`)
  return parts.join(' | ')
}

/**
 * Build PDF, Excel, and Print table data for the current Ledger JV list (Normal JV or Bank JV).
 */
export function buildLedgerJvListExportData({
  vouchers = [],
  ledgerVoucherTab = 'journal',
  baseCurrencyCode = 'USD',
} = {}) {
  const rows = Array.isArray(vouchers) ? vouchers : []
  const isBank = String(ledgerVoucherTab || '').toLowerCase() === 'bank_jv'
  const label = isBank ? 'Bank JV' : 'Normal JV'
  const title = `${label} - List`
  const stamp = new Date().toISOString().slice(0, 10)
  const fileBase = `${isBank ? 'bank-jv' : 'normal-jv'}-list-${stamp}`
  const sheetName = isBank ? 'Bank JV' : 'Normal JV'

  const head = [
    'Date',
    'Voucher No.',
    'Narration / Detail',
    'Debit Account',
    'Credit Account',
    'Amount',
    'Type',
  ]

  const body = rows.map((voucher) => ([
    formatJvDate(voucher?.date),
    String(voucher?.voucherNo || '-'),
    String(voucher?.narration || '-'),
    String(voucher?.debitAccounts || '-'),
    String(voucher?.creditAccounts || '-'),
    formatJvAmountText(voucher, baseCurrencyCode),
    formatJvTypeText(voucher),
  ]))

  const xlsxRows = [
    [title],
    ['Generated', new Date().toLocaleString()],
    ['Rows', body.length],
    [],
    head,
    ...body,
  ]

  return {
    title,
    fileBase,
    sheetName,
    head,
    body,
    xlsxRows,
    rowCount: body.length,
  }
}
