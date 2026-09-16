import { getTenantBranding } from '../../config/tenantBranding'
import { loadPdfTools } from '../erp/lazyExportLibs'

function money(n) {
  const v = Number(n) || 0
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function periodLabel(year, month) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[(Number(month) || 1) - 1]} ${year}`
}

/**
 * Generate a LoopC payslip PDF via jspdf + autotable.
 * Bank details are masked; employer contributions are a separate section.
 */
export async function generatePayslipPdf(payslip, tenant) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const branding = getTenantBranding(tenant)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  let y = margin

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(branding.displayName || branding.companyName || 'Company', margin, y)
  y += 18
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Payslip', margin, y)
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
  doc.text(`Bank: ${payslip.bankMasked || '****'}`, margin, y)
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
  doc.text(`Gross: ${money(payslip.gross)}`, margin, y)
  doc.text(`Deductions: ${money(payslip.totalDeductions)}`, 220, y)
  doc.text(`Net Pay: ${money(payslip.net)}`, 400, y)
  y += 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
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

  const filename = `${payslip.number || 'payslip'}.pdf`
  doc.save(filename)
  return filename
}
