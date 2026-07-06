import { buildExpensePdfFileName, buildExpensesPdfTableBody } from './expenseExportHelpers'
import { loadPdfTools } from './lazyExportLibs'

function formatPdfAmount(value) {
  const n = Number(value || 0)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export async function exportExpenseRegisterPdf({ items = [], meta = {}, year, monthIndex = '' } = {}) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  doc.setFillColor(0, 104, 74)
  doc.rect(24, 20, 799, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(17, 24, 39)
  doc.text(meta.title || 'Expense Report', 36, 48)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(55, 65, 81)
  let metaY = 64
  ;(meta.lines || []).forEach((line) => {
    doc.text(String(line), 36, metaY)
    metaY += 12
  })

  autoTable(doc, {
    head: [['Date', 'Category', 'Description', 'Amount', 'Type', 'Account Route', 'Ledger']],
    body: buildExpensesPdfTableBody(items),
    startY: metaY + 8,
    tableWidth: 'auto',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { cellWidth: 78 },
      2: { cellWidth: 118, overflow: 'linebreak' },
      3: { halign: 'right', cellWidth: 62 },
      4: { cellWidth: 44 },
      5: { cellWidth: 210, overflow: 'linebreak' },
      6: { cellWidth: 88, overflow: 'linebreak' },
    },
    margin: { left: 24, right: 24 },
  })

  const finalY = doc.lastAutoTable?.finalY || metaY + 40
  doc.setFontSize(9)
  doc.setTextColor(17, 24, 39)
  doc.text(`Report total: ${formatPdfAmount(meta.totalAmount)}`, 36, finalY + 20)
  if (meta.truncated) {
    doc.setTextColor(107, 114, 128)
    doc.text(`Showing ${meta.exportedCount} of ${meta.total} entries (API export limit).`, 36, finalY + 34)
  }

  doc.save(buildExpensePdfFileName({ year, monthIndex }))
}
