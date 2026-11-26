import { escapeHtml } from '../../../utils/safeHtml'
import { downloadXlsxRows } from './exportHelpers'
import { openPrintWindow } from './erpPrintHelpers'
import { loadPdfTools } from './lazyExportLibs'
import { buildLedgerJvListExportData } from './ledgerJvListExportHelpers'

export async function exportLedgerJvListPdf({
  vouchers = [],
  ledgerVoucherTab = 'journal',
  baseCurrencyCode = 'USD',
} = {}) {
  const data = buildLedgerJvListExportData({ vouchers, ledgerVoucherTab, baseCurrencyCode })
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(data.title, 36, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Generated: ${new Date().toLocaleString()}  ·  ${data.rowCount} row${data.rowCount === 1 ? '' : 's'}`,
    36,
    54,
  )
  autoTable(doc, {
    head: [data.head],
    body: data.body,
    startY: 72,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [234, 88, 12] },
    alternateRowStyles: { fillColor: [255, 247, 237] },
    columnStyles: {
      5: { halign: 'right' },
    },
    margin: { left: 24, right: 24 },
  })
  doc.save(`${data.fileBase}.pdf`)
  return { rowCount: data.rowCount }
}

export async function exportLedgerJvListExcel({
  vouchers = [],
  ledgerVoucherTab = 'journal',
  baseCurrencyCode = 'USD',
} = {}) {
  const data = buildLedgerJvListExportData({ vouchers, ledgerVoucherTab, baseCurrencyCode })
  await downloadXlsxRows(data.xlsxRows, `${data.fileBase}.xlsx`, data.sheetName)
  return { rowCount: data.rowCount }
}

export function printLedgerJvList({
  vouchers = [],
  ledgerVoucherTab = 'journal',
  baseCurrencyCode = 'USD',
  setError = null,
} = {}) {
  const data = buildLedgerJvListExportData({ vouchers, ledgerVoucherTab, baseCurrencyCode })
  const headHtml = data.head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('')
  const bodyHtml = data.body.map((row) => (
    `<tr>${row.map((cell, index) => {
      const isNum = index === 5
      return `<td class="${isNum ? 'num' : 'text'}">${escapeHtml(cell)}</td>`
    }).join('')}</tr>`
  )).join('')
  const html = `
    <div class="doc-head">
      <div>
        <div class="title">${escapeHtml(data.title)}</div>
        <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
        <div class="meta">${data.rowCount} row${data.rowCount === 1 ? '' : 's'}</div>
      </div>
    </div>
    <table>
      <thead><tr>${headHtml}</tr></thead>
      <tbody>${bodyHtml || `<tr><td colspan="${data.head.length}">No vouchers</td></tr>`}</tbody>
    </table>
  `
  openPrintWindow(data.title, html, typeof setError === 'function' ? setError : () => {}, { landscape: true })
  return { rowCount: data.rowCount }
}
