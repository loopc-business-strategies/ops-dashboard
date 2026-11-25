import { escapeHtml } from '../../../utils/safeHtml'
import { openPrintWindow } from '../erp/erpPrintHelpers'
import { loadPdfTools } from '../erp/lazyExportLibs'
import { buildVoucherListExportTable } from './voucherListExportHelpers'

function safeFileSlug(label = '') {
  return String(label || 'voucher')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'voucher'
}

export async function exportVoucherListPdf({
  vouchers = [],
  voucherType = '',
  voucherLabel = 'Voucher',
  isSimpleMetalVoucher = false,
  baseCurrencyCode = 'USD',
  resolvePartyDisplayName = null,
} = {}) {
  const { head, body, rowCount } = buildVoucherListExportTable({
    vouchers,
    voucherType,
    isSimpleMetalVoucher,
    baseCurrencyCode,
    resolvePartyDisplayName,
  })
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const title = `${voucherLabel} — List`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, 36, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Generated: ${new Date().toLocaleString()}  ·  ${rowCount} row${rowCount === 1 ? '' : 's'}`,
    36,
    54,
  )
  autoTable(doc, {
    head: [head],
    body,
    startY: 72,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [234, 88, 12] },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    margin: { left: 24, right: 24 },
  })
  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`${safeFileSlug(voucherLabel)}-list-${stamp}.pdf`)
  return { rowCount }
}

export function printVoucherList({
  vouchers = [],
  voucherType = '',
  voucherLabel = 'Voucher',
  isSimpleMetalVoucher = false,
  baseCurrencyCode = 'USD',
  resolvePartyDisplayName = null,
  setError = null,
} = {}) {
  const { head, body, rowCount } = buildVoucherListExportTable({
    vouchers,
    voucherType,
    isSimpleMetalVoucher,
    baseCurrencyCode,
    resolvePartyDisplayName,
  })
  const title = `${voucherLabel} — List`
  const headHtml = head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')
  const bodyHtml = body.map((row) => (
    `<tr>${row.map((cell, index) => {
      const isNum = index === row.length - 2
      return `<td class="${isNum ? 'num' : 'text'}">${escapeHtml(cell)}</td>`
    }).join('')}</tr>`
  )).join('')
  const html = `
    <div class="doc-head">
      <div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
        <div class="meta">${rowCount} row${rowCount === 1 ? '' : 's'}</div>
      </div>
    </div>
    <table>
      <thead><tr>${headHtml}</tr></thead>
      <tbody>${bodyHtml || `<tr><td colspan="${head.length}">No vouchers</td></tr>`}</tbody>
    </table>
  `
  openPrintWindow(title, html, typeof setError === 'function' ? setError : () => {}, { landscape: true })
  return { rowCount }
}
