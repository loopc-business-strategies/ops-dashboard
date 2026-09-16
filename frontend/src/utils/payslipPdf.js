import { getTenantBranding } from '../config/tenantBranding'
import { loadPdfTools } from '../components/tabs/erp/lazyExportLibs'

function money(n) {
  const v = Number(n) || 0
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

/**
 * Generate a LoopC payslip PDF via jspdf + autotable.
 * Shows earned vs amount paid vs salary balance (arrears — not advance).
 */
export async function generatePayslipPdf(payslip, tenant) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const branding = getTenantBranding(tenant)
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
