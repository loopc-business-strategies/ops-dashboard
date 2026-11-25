import {
  computeVoucherGrandTotal,
  displayVoucherDocNo,
  fmt,
  formatVoucherWorkflowStatusLabel,
  isMetalStockVoucherType,
} from '../erp/voucherUtils'
import { resolveVoucherFixingBadge } from './voucherFixingHelpers'

function resolvePartyName(voucher, resolvePartyDisplayName) {
  const meta = voucher?.voucherMeta || {}
  if (typeof resolvePartyDisplayName === 'function') {
    return resolvePartyDisplayName(meta.partyCode, meta.partyName) || meta.partyName || '-'
  }
  return meta.partyName || '-'
}

function resolveDocDate(voucher) {
  const meta = voucher?.voucherMeta || {}
  if (meta.docDate) return String(meta.docDate).slice(0, 10)
  if (voucher?.date) return String(voucher.date).slice(0, 10)
  return '-'
}

function resolveValueDate(voucher) {
  const meta = voucher?.voucherMeta || {}
  if (meta.valueDate) return String(meta.valueDate).slice(0, 10)
  if (voucher?.date) return String(voucher.date).slice(0, 10)
  return '-'
}

/**
 * Build PDF/print columns + rows from the current voucher list (matches on-screen columns).
 */
export function buildVoucherListExportTable({
  vouchers = [],
  voucherType = '',
  isSimpleMetalVoucher = false,
  baseCurrencyCode = 'USD',
  resolvePartyDisplayName = null,
} = {}) {
  const rows = Array.isArray(vouchers) ? vouchers : []
  const showValueDate = !isSimpleMetalVoucher
  const showCurrency = !isSimpleMetalVoucher
  const showFixing = isMetalStockVoucherType(voucherType) && !isSimpleMetalVoucher

  const head = ['Doc No', 'Doc Date']
  if (showValueDate) head.push('Value Date')
  head.push('Party Code', 'Party Name')
  if (showFixing) head.push('Fixing')
  if (showCurrency) head.push('Currency')
  head.push('Grand Total', 'Status')

  const body = rows.map((voucher) => {
    const meta = voucher?.voucherMeta || {}
    const type = voucher?.type || voucherType
    const grand = computeVoucherGrandTotal(voucher, type)
    const grandCurrency = isMetalStockVoucherType(type) && !isSimpleMetalVoucher
      ? (baseCurrencyCode || 'USD')
      : (voucher?.currency || baseCurrencyCode || 'USD')
    const cells = [
      displayVoucherDocNo(voucher) || '-',
      resolveDocDate(voucher),
    ]
    if (showValueDate) cells.push(resolveValueDate(voucher))
    cells.push(meta.partyCode || '-', resolvePartyName(voucher, resolvePartyDisplayName))
    if (showFixing) {
      cells.push(resolveVoucherFixingBadge(voucher).label || '-')
    }
    if (showCurrency) cells.push(voucher?.currency || '-')
    cells.push(fmt(grand, grandCurrency))
    cells.push(formatVoucherWorkflowStatusLabel(voucher?.status, type) || voucher?.status || '-')
    return cells
  })

  return { head, body, rowCount: body.length }
}
