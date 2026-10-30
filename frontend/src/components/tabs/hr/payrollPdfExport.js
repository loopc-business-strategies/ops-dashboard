async function loadPdfTools() {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable: autoTableMod.default || autoTableMod }
}

function formatPdfMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function monthYearLabel(year, month) {
  const d = new Date(year, month - 1, 1)
  if (Number.isNaN(d.getTime())) return `${year}-${month}`
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

/**
 * Download current-month payroll PDF (employee rows + grand totals).
 * @param {{ rows: Array, totals: object, year: number, month: number, companyName?: string }} opts
 */
export async function downloadPayrollPdf({
  rows = [],
  totals = {},
  year,
  month,
  companyName = '',
} = {}) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const period = monthYearLabel(year, month)
  const employeeCount = rows.length

  let y = 36
  pdf.setFontSize(14)
  pdf.setFont(undefined, 'bold')
  pdf.text('Monthly Payroll Report', 40, y)
  y += 18
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'normal')
  if (companyName) {
    pdf.text(String(companyName), 40, y)
    y += 14
  }
  pdf.text(`Period: ${period}`, 40, y)
  pdf.text(`Employees: ${employeeCount}`, 280, y)
  pdf.text(`Generated: ${new Date().toLocaleString()}`, 420, y)
  y += 16

  const body = rows.map((row) => [
    row.name || '—',
    row.employeeCode || '—',
    String(row.workedDays ?? 0),
    formatPdfMoney(row.salaryAgreed),
    formatPdfMoney(row.rebate),
    formatPdfMoney(row.accumulated),
    formatPdfMoney(row.personalTax),
    formatPdfMoney(row.socialTax),
    formatPdfMoney(row.netPayable),
  ])

  autoTable(pdf, {
    startY: y,
    head: [[
      'Name',
      'Code',
      'Worked days',
      'Salary agreed',
      'Rebate',
      'Accumulated (MTD)',
      'Personal tax',
      'Social tax',
      'Net payable',
    ]],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    margin: { left: 36, right: 36 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  })

  const endY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 20 : y + 40
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text('Grand totals', 40, endY)
  pdf.setFont(undefined, 'normal')
  pdf.setFontSize(10)

  const summaryLines = [
    `Gross salary (MTD): ${formatPdfMoney(totals.gross)}`,
    `Total rebate: ${formatPdfMoney(totals.rebate)}`,
    `Personal tax: ${formatPdfMoney(totals.personalTax)}`,
    `Social tax: ${formatPdfMoney(totals.socialTax)}`,
    `Taxes total: ${formatPdfMoney(totals.taxesTotal)}`,
    `Net payable (salary to pay): ${formatPdfMoney(totals.netPayable)}`,
  ]
  summaryLines.forEach((line, i) => {
    pdf.text(line, 40, endY + 16 + i * 14)
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const monthPad = String(month).padStart(2, '0')
  pdf.save(`payroll-report-${year}-${monthPad}-${stamp}.pdf`)
}
