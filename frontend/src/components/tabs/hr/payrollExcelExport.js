async function loadExcel() {
  const mod = await import('exceljs')
  return mod.default || mod
}

function formatMoneyCell(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function monthYearLabel(year, month, langCode = 'en') {
  const d = new Date(year, month - 1, 1)
  if (Number.isNaN(d.getTime())) return `${year}-${month}`
  const locale = langCode === 'ru' ? 'ru-RU' : langCode === 'uz' ? 'uz-UZ' : 'en-US'
  return d.toLocaleString(locale, { month: 'long', year: 'numeric' })
}

function statusLabel(row, labels) {
  const rebateN = Number(row.rebate)
  if (!Number.isFinite(rebateN) || rebateN <= 0) return '—'
  return row.rebateCollected ? (labels.collected || 'Collected') : (labels.pending || 'Pending')
}

/**
 * Download current-month payroll Excel (Payroll sheet + Summary sheet).
 */
export async function downloadPayrollExcel({
  rows = [],
  totals = {},
  year,
  month,
  companyName = '',
  langCode = 'en',
  labels = {},
} = {}) {
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  const period = monthYearLabel(year, month, langCode)
  const L = {
    payrollSheet: labels.payrollSheet || 'Payroll',
    summarySheet: labels.summarySheet || 'Summary',
    title: labels.title || 'Monthly Payroll Report',
    period: labels.period || 'Period',
    company: labels.company || 'Company',
    generated: labels.generated || 'Generated',
    name: labels.name || 'Name',
    code: labels.code || 'Code',
    phone: labels.phone || 'Phone',
    workedDays: labels.workedDays || 'Worked days',
    salaryAgreed: labels.salaryAgreed || 'Salary agreed',
    rebate: labels.rebate || 'Rebate',
    rebatesCollectedAmount: labels.rebatesCollectedAmount || 'Rebates collected',
    rebateStatus: labels.rebateStatus || 'Rebate status',
    accumulatedMtd: labels.accumulatedMtd || 'Accumulated (MTD)',
    personalTax: labels.personalTax || 'Personal tax',
    socialTax: labels.socialTax || 'Social tax',
    netPayable: labels.netPayable || 'Net payable',
    totalEmployees: labels.totalEmployees || 'Total employees',
    grossTotalSalary: labels.grossTotalSalary || 'Gross total salary',
    totalPersonalTax: labels.totalPersonalTax || 'Total personal tax',
    totalSocialTax: labels.totalSocialTax || 'Total social tax',
    totalRebatesCollected: labels.totalRebatesCollected || 'Total rebates collected',
    netExpense: labels.netExpense || 'Net expense',
    employeesWithRebate: labels.employeesWithRebate || 'Employees with rebate',
    employeesWithoutRebate: labels.employeesWithoutRebate || 'Employees without rebate',
    pendingRebates: labels.pendingRebates || 'Pending rebates',
    collected: labels.collected || 'Collected',
    pending: labels.pending || 'Pending',
  }

  const payroll = workbook.addWorksheet(L.payrollSheet)
  payroll.addRow([L.title]).font = { bold: true }
  payroll.addRow([`${L.period}: ${period}`])
  if (companyName) payroll.addRow([`${L.company}: ${companyName}`])
  payroll.addRow([`${L.generated}: ${new Date().toLocaleString()}`])
  payroll.addRow([])
  const headerRow = payroll.addRow([
    L.name,
    L.code,
    L.phone,
    L.workedDays,
    L.salaryAgreed,
    L.rebate,
    L.rebatesCollectedAmount,
    L.rebateStatus,
    L.accumulatedMtd,
    L.personalTax,
    L.socialTax,
    L.netPayable,
  ])
  headerRow.font = { bold: true }

  for (const row of rows) {
    payroll.addRow([
      row.name || '',
      row.employeeCode || '',
      row.phoneNumber || '',
      Number(row.workedDays) || 0,
      formatMoneyCell(row.salaryAgreed),
      formatMoneyCell(row.rebate),
      row.rebateCollected ? formatMoneyCell(row.rebateCollectedAmount) : null,
      statusLabel(row, L),
      formatMoneyCell(row.accumulated),
      formatMoneyCell(row.personalTax),
      formatMoneyCell(row.socialTax),
      formatMoneyCell(row.netPayable),
    ])
  }

  payroll.columns = [
    { width: 28 },
    { width: 14 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ]

  const summary = workbook.addWorksheet(L.summarySheet)
  summary.addRow([L.title])
  summary.addRow([`${L.period}: ${period}`])
  if (companyName) summary.addRow([`${L.company}: ${companyName}`])
  summary.addRow([`${L.generated}: ${new Date().toLocaleString()}`])
  summary.addRow([])
  summary.addRow([L.totalEmployees, totals.employeeCount ?? rows.length])
  summary.addRow([L.employeesWithRebate, totals.employeesWithRebate ?? 0])
  summary.addRow([L.employeesWithoutRebate, totals.employeesWithoutRebate ?? 0])
  summary.addRow([L.pendingRebates, totals.pendingRebateCount ?? 0])
  summary.addRow([L.grossTotalSalary, formatMoneyCell(totals.gross)])
  summary.addRow([L.totalPersonalTax, formatMoneyCell(totals.personalTax)])
  summary.addRow([L.totalSocialTax, formatMoneyCell(totals.socialTax)])
  summary.addRow([L.netPayable || 'Net payable', formatMoneyCell(totals.netPayable)])
  summary.addRow([L.rebate, formatMoneyCell(totals.rebate)])
  summary.addRow([L.totalRebatesCollected, formatMoneyCell(totals.rebateCollected)])
  summary.addRow([L.netExpense, formatMoneyCell(totals.netExpense)])
  summary.getColumn(1).width = 32
  summary.getColumn(2).width = 18
  summary.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const stamp = new Date().toISOString().slice(0, 10)
  const monthPad = String(month).padStart(2, '0')
  const fileName = `payroll-report-${year}-${monthPad}-${stamp}.xlsx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
