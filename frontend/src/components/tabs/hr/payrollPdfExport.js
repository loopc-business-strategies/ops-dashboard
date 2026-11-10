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

function monthYearLabel(year, month, langCode = 'en') {
  const d = new Date(year, month - 1, 1)
  if (Number.isNaN(d.getTime())) return `${year}-${month}`
  const locale = langCode === 'ru' ? 'ru-RU' : langCode === 'uz' ? 'uz-UZ' : 'en-US'
  return d.toLocaleString(locale, { month: 'long', year: 'numeric' })
}

function formatCollected(row, yesLabel = 'Yes', noLabel = 'No') {
  const rebateN = Number(row.rebate)
  if (!Number.isFinite(rebateN) || rebateN <= 0) return '—'
  return row.rebateCollected ? yesLabel : noLabel
}

function formatCollectedAmount(row) {
  if (!row.rebateCollected) return '—'
  return formatPdfMoney(row.rebateCollectedAmount)
}

/**
 * Download current-month payroll PDF (employee rows + grand totals).
 * @param {{ rows: Array, totals: object, year: number, month: number, companyName?: string, langCode?: string, labels?: object }} opts
 */
export async function downloadPayrollPdf({
  rows = [],
  totals = {},
  year,
  month,
  companyName = '',
  langCode = 'en',
  labels = {},
} = {}) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const period = monthYearLabel(year, month, langCode)
  const employeeCount = rows.length
  const L = {
    title: labels.title || 'Monthly Payroll Report',
    period: labels.period || 'Period',
    employees: labels.employees || 'Employees',
    generated: labels.generated || 'Generated',
    name: labels.name || 'Name',
    code: labels.code || 'Code',
    phone: labels.phone || 'Phone',
    workedDays: labels.workedDays || 'Worked days',
    salaryAgreed: labels.salaryAgreed || 'Salary agreed',
    rebate: labels.rebate || 'Rebate',
    rebatesCollectedAmount: labels.rebatesCollectedAmount || 'Rebates collected',
    collected: labels.collected || 'Collected',
    accumulatedMtd: labels.accumulatedMtd || 'Accumulated (MTD)',
    personalTax: labels.personalTax || 'Personal tax',
    socialTax: labels.socialTax || 'Social tax',
    netPayable: labels.netPayable || 'Net payable',
    grandTotals: labels.grandTotals || 'Grand totals',
    grossTotalSalary: labels.grossTotalSalary || 'Gross total salary',
    totalPersonalTax: labels.totalPersonalTax || 'Total personal tax',
    totalSocialTax: labels.totalSocialTax || 'Total social tax',
    totalRebatesCollected: labels.totalRebatesCollected || 'Total rebates collected',
    netExpense: labels.netExpense || 'Net expense',
    totalEmployees: labels.totalEmployees || 'Total employees',
    employeesWithRebate: labels.employeesWithRebate || 'Employees with rebate',
    employeesWithoutRebate: labels.employeesWithoutRebate || 'Employees without rebate',
    yes: labels.yes || 'Yes',
    no: labels.no || 'No',
  }

  let y = 36
  pdf.setFontSize(14)
  pdf.setFont(undefined, 'bold')
  pdf.text(L.title, 40, y)
  y += 18
  pdf.setFontSize(10)
  pdf.setFont(undefined, 'normal')
  if (companyName) {
    pdf.text(String(companyName), 40, y)
    y += 14
  }
  pdf.text(`${L.period}: ${period}`, 40, y)
  pdf.text(`${L.employees}: ${employeeCount}`, 280, y)
  pdf.text(`${L.generated}: ${new Date().toLocaleString()}`, 420, y)
  y += 16

  const body = rows.map((row) => [
    row.name || '—',
    row.employeeCode || '—',
    row.phoneNumber || '—',
    String(row.workedDays ?? 0),
    formatPdfMoney(row.salaryAgreed),
    formatPdfMoney(row.rebate),
    formatCollectedAmount(row),
    formatCollected(row, L.yes, L.no),
    formatPdfMoney(row.accumulated),
    formatPdfMoney(row.personalTax),
    formatPdfMoney(row.socialTax),
    formatPdfMoney(row.netPayable),
  ])

  autoTable(pdf, {
    startY: y,
    head: [[
      L.name,
      L.code,
      L.phone,
      L.workedDays,
      L.salaryAgreed,
      L.rebate,
      L.rebatesCollectedAmount,
      L.collected,
      L.accumulatedMtd,
      L.personalTax,
      L.socialTax,
      L.netPayable,
    ]],
    body,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [51, 65, 85], textColor: 255 },
    margin: { left: 24, right: 24 },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'center' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
      11: { halign: 'right' },
    },
  })

  const endY = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 20 : y + 40
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text(L.grandTotals, 40, endY)
  pdf.setFont(undefined, 'normal')
  pdf.setFontSize(10)

  const summaryLines = [
    `1. ${L.totalEmployees || 'Total employees'}: ${totals.employeeCount ?? rows.length}`,
    `2. ${L.employeesWithRebate || 'Employees with rebate'}: ${totals.employeesWithRebate ?? 0}`,
    `3. ${L.employeesWithoutRebate || 'Employees without rebate'}: ${totals.employeesWithoutRebate ?? 0}`,
    `4. ${L.grossTotalSalary}: ${formatPdfMoney(totals.gross)}`,
    `5. ${L.totalPersonalTax}: ${formatPdfMoney(totals.personalTax)}`,
    `6. ${L.totalSocialTax}: ${formatPdfMoney(totals.socialTax)}`,
    `7. ${L.netPayable}: ${formatPdfMoney(totals.netPayable)}`,
    `8. ${L.rebate}: ${formatPdfMoney(totals.rebate)}`,
    `9. ${L.totalRebatesCollected}: ${formatPdfMoney(totals.rebateCollected)}`,
    `10. ${L.netExpense}: ${formatPdfMoney(totals.netExpense)}`,
  ]
  summaryLines.forEach((line, i) => {
    pdf.text(line, 40, endY + 16 + i * 14)
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const monthPad = String(month).padStart(2, '0')
  pdf.save(`payroll-report-${year}-${monthPad}-${stamp}.pdf`)
}
