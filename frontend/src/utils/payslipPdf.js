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

function numOrZero(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

/** Presentation-only: unpaid residual (salaryBalance) shown as prev-month advance deduction. */
function previousMonthAdvanceDeductionOf(payslip) {
  return numOrZero(payslip.salaryBalance)
}

function currentMonthAdvanceDeductionOf(payslip) {
  return numOrZero(payslip.advanceDeduction)
}

/** Display-only total; does not overwrite payslip.totalDeductions. */
function displayTotalDeductionsOf(payslip) {
  return Math.round(
    (currentMonthAdvanceDeductionOf(payslip)
      + previousMonthAdvanceDeductionOf(payslip)
      + numOrZero(otherDeductionsOf(payslip))) * 100
  ) / 100
}

function inrMoney(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `INR ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function salaryCalculatedOf(payslip) {
  if (payslip.salaryCalculated != null) return payslip.salaryCalculated
  const prev = Number(payslip.previousArrears) || 0
  const gross = Number(payslip.gross) || 0
  if (prev > 0) return Math.round((gross - prev) * 100) / 100
  return payslip.net ?? payslip.gross
}

function amountOf(item) {
  const n = Number(item?.amount)
  return Number.isFinite(n) ? n : 0
}

/** True when earnings add detail beyond a single BASIC matching Salary Calculated. */
function shouldShowEarningsBreakdown(payslip) {
  const earnings = Array.isArray(payslip.earnings) ? payslip.earnings : []
  if (!earnings.length) return false
  if (earnings.length > 1) return true
  const only = earnings[0]
  const code = String(only?.code || '').toUpperCase()
  if (code !== 'BASIC') return true
  const calc = Number(salaryCalculatedOf(payslip))
  const line = amountOf(only)
  return Math.abs(calc - line) > 0.009
}

/** True when at least one deduction has amount > 0. */
function shouldShowDeductionsBreakdown(payslip) {
  const deductions = Array.isArray(payslip.deductions) ? payslip.deductions : []
  return deductions.some((d) => amountOf(d) > 0)
}

function hasEmployerContributions(payslip) {
  const rows = Array.isArray(payslip.employerContributions) ? payslip.employerContributions : []
  return rows.some((r) => amountOf(r) > 0) || Number(payslip.employerTotal) > 0
}

/**
 * Generate a payslip PDF via jspdf + autotable.
 * LoopC structured: compact header + Employee/Salary Details only (no duplicate blocks).
 * Other tenants: legacy full header + earned/paid/balance lines.
 * Presentation only — does not mutate payslip data.
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

  if (structured) {
    doc.text(`Payslip No: ${payslip.number || '—'}`, margin, y)
    doc.text(`Department: ${payslip.department || '—'}`, 320, y)
    y += 14
    doc.text(`Bank: ${payslip.bankMasked || '****'}`, margin, y)
    y += 16

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
        ['Monthly Salary', inrMoney(payslip.monthlySalary)],
        ['Salary Calculated', inrMoney(salaryCalculatedOf(payslip))],
        ['Previous Arrears', inrMoney(payslip.previousArrears ?? 0)],
        ['Gross Amount', inrMoney(payslip.gross)],
        ['Current Month Advance Payment Deduction', inrMoney(currentMonthAdvanceDeductionOf(payslip))],
        // Presentation alias of stored salaryBalance (unpaid residual) — not a second transaction
        ['Previous Month Advance Payment Deduction', inrMoney(previousMonthAdvanceDeductionOf(payslip))],
        ['Other Deductions', inrMoney(otherDeductionsOf(payslip))],
        ['Total Deductions', inrMoney(displayTotalDeductionsOf(payslip))],
        ['Net Paid / Amount Paid', inrMoney(payslip.amountPaid)],
      ],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 300 }, 1: { halign: 'right', cellWidth: 110 } },
      headStyles: { fillColor: [30, 41, 59] },
    })
    y = doc.lastAutoTable.finalY + 14

    if (shouldShowEarningsBreakdown(payslip)) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Earnings breakdown', margin, y)
      y += 6
      const earningsRows = (payslip.earnings || []).map((r) => [r.code || '', r.label || '', money(r.amount)])
      autoTable(doc, {
        startY: y,
        head: [['Code', 'Earnings', 'Amount']],
        body: earningsRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 41, 59] },
      })
      y = doc.lastAutoTable.finalY + 12
    }

    if (shouldShowDeductionsBreakdown(payslip)) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Deductions breakdown', margin, y)
      y += 6
      const dedRows = (payslip.deductions || [])
        .filter((d) => amountOf(d) > 0)
        .map((r) => [r.code || '', r.label || '', money(r.amount)])
      autoTable(doc, {
        startY: y,
        head: [['Code', 'Deductions', 'Amount']],
        body: dedRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [127, 29, 29] },
      })
      y = doc.lastAutoTable.finalY + 12
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    if (hasEmployerContributions(payslip)) {
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
    } else {
      doc.text(`Employer total: ${money(payslip.employerTotal ?? 0)}`, margin, y)
      y += 14
    }

    doc.setFont('helvetica', 'normal')
    doc.text(`Payment date: ${fmtDate(payslip.paymentDate)} · Status: ${payslip.paymentStatus || '—'}`, margin, y)
  } else {
    // Legacy full header (non-LoopC / non-structured)
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
    y += 20

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
  }

  const filename = `${payslip.number || 'payslip'}.pdf`
  doc.save(filename)
  return filename
}
