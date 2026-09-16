import { getTenantBranding, isStructuredPayrollEnabled } from '../config/tenantBranding'
import { loadPdfTools } from '../components/tabs/erp/lazyExportLibs'

function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function periodLabel(year, month) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[(Number(month) || 1) - 1]} ${year}`
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return '—'
  }
}

/** Display-only period when stored bounds are missing (does not write DB). */
function displayPeriodRange(payslip) {
  if (payslip.periodStart && payslip.periodEnd) {
    return `${fmtDate(payslip.periodStart)} to ${fmtDate(payslip.periodEnd)}`
  }
  const y = Number(payslip.year)
  const m = Number(payslip.month)
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return periodLabel(payslip.year, payslip.month)
  }
  const monthStart = new Date(Date.UTC(y, m - 1, 1))
  const monthEnd = new Date(Date.UTC(y, m, 0))
  let start = monthStart
  if (payslip.joiningDate) {
    const join = new Date(payslip.joiningDate)
    if (!Number.isNaN(join.getTime())) {
      const joinUtc = new Date(Date.UTC(join.getUTCFullYear(), join.getUTCMonth(), join.getUTCDate()))
      if (joinUtc > monthStart && joinUtc <= monthEnd) start = joinUtc
    }
  }
  return `${fmtDate(start)} to ${fmtDate(monthEnd)}`
}

function otherDeductionsOf(payslip) {
  if (payslip.otherDeductions != null) return payslip.otherDeductions
  const total = Number(payslip.totalDeductions) || 0
  const adv = Number(payslip.advanceDeduction) || 0
  return Math.round((total - adv) * 100) / 100
}

function salaryCalculatedOf(payslip) {
  if (payslip.salaryCalculated != null) return payslip.salaryCalculated
  const prev = Number(payslip.previousArrears) || 0
  const gross = Number(payslip.gross) || 0
  if (prev > 0) return Math.round((gross - prev) * 100) / 100
  return payslip.net ?? payslip.gross
}

/**
 * Generate a LoopC payslip PDF via jspdf + autotable.
 * Shows earned vs amount paid vs salary balance (arrears — not advance).
 * LoopC structured tenants also get employee + salary summary tables (additive).
 */
export async function generatePayslipPdf(payslip, tenant) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const branding = getTenantBranding(tenant)
  const structured = isStructuredPayrollEnabled(tenant)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = margin

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(branding.displayName || branding.companyName || 'LoopC', margin, y)
  y += 18
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('PAYSLIP', margin, y)
  y += 16
  doc.setFontSize(10)
  doc.text(`Payslip No: ${payslip.number || '—'}`, margin, y)
  doc.text(`Period: ${periodLabel(payslip.year, payslip.month)}`, 320, y)
  y += 14
  doc.text(`Employee: ${payslip.employeeName || '—'} (${payslip.employeeCode || '—'})`, margin, y)
  y += 14
  doc.text(`Department: ${payslip.department || '—'}`, margin, y)
  doc.text(`Position: ${payslip.position || '—'}`, 320, y)
  y += 14
  doc.text(`Joining date: ${fmtDate(payslip.joiningDate)}`, margin, y)
  doc.text(`Bank: ${payslip.bankMasked || '****'}`, 320, y)
  y += 14
  doc.text(`Payable days: ${payslip.payableDays ?? '—'}`, margin, y)
  doc.text(`Monthly salary: ${money(payslip.monthlySalary)}`, 320, y)
  y += 16

  if (structured) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Employee Details', margin, y)
    y += 6
    autoTable(doc, {
      startY: y,
      head: [['Field', 'Value']],
      body: [
        ['Employee Name', payslip.employeeName || '—'],
        ['Position', payslip.position || '—'],
        ['Joining Date', fmtDate(payslip.joiningDate)],
        ['Payroll Period', displayPeriodRange(payslip)],
        ['No. of Days', payslip.payableDays != null ? String(payslip.payableDays) : '—'],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 160 }, 1: { cellWidth: 'auto' } },
      headStyles: { fillColor: [30, 41, 59] },
    })
    y = doc.lastAutoTable.finalY + 14

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Salary Details', margin, y)
    y += 6
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Amount']],
      body: [
        ['Monthly Salary', money(payslip.monthlySalary)],
        ['Salary Calculated', money(salaryCalculatedOf(payslip))],
        ['Previous Arrears', money(payslip.previousArrears)],
        ['Gross Amount', money(payslip.gross)],
        ['Deduction Towards Advance Payment', money(payslip.advanceDeduction)],
        ['Other Deductions', money(otherDeductionsOf(payslip))],
        ['Total Deductions', money(payslip.totalDeductions)],
        ['Net Pay / Amount Paid', money(payslip.amountPaid)],
        ['Balance', money(payslip.salaryBalance)],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 280 }, 1: { halign: 'right', cellWidth: 100 } },
      headStyles: { fillColor: [30, 41, 59] },
    })
    y = doc.lastAutoTable.finalY + 14
  }

  const earningsRows = (payslip.earnings || []).map((r) => [r.code || '', r.label || '', money(r.amount)])
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Earnings', 'Amount']],
    body: earningsRows.length ? earningsRows : [['—', 'No earnings', '0.00']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  })
  y = doc.lastAutoTable.finalY + 12

  const dedRows = (payslip.deductions || []).map((r) => [r.code || '', r.label || '', money(r.amount)])
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Deductions', 'Amount']],
    body: dedRows.length ? dedRows : [['—', 'No deductions', '0.00']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [127, 29, 29] },
  })
  y = doc.lastAutoTable.finalY + 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Earned salary: ${money(payslip.net ?? payslip.gross)}`, margin, y)
  y += 14
  doc.text(`Amount paid: ${money(payslip.amountPaid)}`, margin, y)
  y += 14
  doc.setTextColor(146, 64, 14)
  doc.text(`Salary balance (arrears): ${money(payslip.salaryBalance)}`, margin, y)
  doc.setTextColor(0, 0, 0)
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Salary balance is earned but unpaid salary. It is not an employee advance.', margin, y)
  y += 16

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Employer contributions (not part of net pay)', margin, y)
  y += 8

  const empRows = (payslip.employerContributions || []).map((r) => [r.code || '', r.label || '', money(r.amount)])
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Employer component', 'Amount']],
    body: empRows.length ? empRows : [['—', 'None', '0.00']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 64, 175] },
  })
  y = doc.lastAutoTable.finalY + 12
  doc.setFont('helvetica', 'bold')
  doc.text(`Employer total: ${money(payslip.employerTotal)}`, margin, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.text(`Payment date: ${fmtDate(payslip.paymentDate)} · Status: ${payslip.paymentStatus || '—'}`, margin, y)

  const filename = `${payslip.number || 'payslip'}.pdf`
  doc.save(filename)
  return filename
}
