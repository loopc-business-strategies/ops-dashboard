import { getTenantBranding, isStructuredPayrollEnabled } from '../config/tenantBranding'
import { loadPdfTools } from '../components/tabs/erp/lazyExportLibs'
import {
  money,
  inrMoney,
  otherDeductionsOf,
  previousMonthAdvanceDeductionOf,
  currentMonthAdvanceDeductionOf,
  displayTotalDeductionsOf,
  salaryCalculatedOf,
} from './loopcPayrollDisplay'

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

function amountOf(item) {
  const n = Number(item?.amount)
  return Number.isFinite(n) ? n : 0
}

function hasEmployerContributions(payslip) {
  const rows = Array.isArray(payslip.employerContributions) ? payslip.employerContributions : []
  return rows.some((r) => amountOf(r) > 0) || Number(payslip.employerTotal) > 0
}

const HEAD_FILL = [30, 41, 59]
const TABLE_STYLES = { fontSize: 9, cellPadding: 4 }
const VALUE_COL_WIDTH = 110

function twoColStyles(contentWidth) {
  const labelW = Math.max(160, contentWidth - VALUE_COL_WIDTH)
  return {
    0: { cellWidth: labelW, fontStyle: 'bold' },
    1: { cellWidth: VALUE_COL_WIDTH, halign: 'right' },
  }
}

/** Make near-black plate transparent; preserve navy ink and gradient C. */
function removeNearBlackBackground(ctx, width, height) {
  try {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a === 0) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const chroma = max - min
      const navyLike = b > r + 8 && b > g + 8
      // Flat near-black plate only. Keep navy ink and saturated gradient C.
      if (!navyLike && max <= 48 && chroma <= 16) {
        data[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
  } catch {
    // Keep original pixels if canvas is tainted or unavailable.
  }
}

/** Crop canvas to non-transparent content with a small padding. */
function cropToOpaqueBounds(sourceCanvas, pad = 4) {
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  const ctx = sourceCanvas.getContext('2d')
  if (!ctx || !w || !h) return sourceCanvas
  let imageData
  try {
    imageData = ctx.getImageData(0, 0, w, h)
  } catch {
    return sourceCanvas
  }
  const data = imageData.data
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = data[(y * w + x) * 4 + 3]
      if (a > 8) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return sourceCanvas
  const left = Math.max(0, minX - pad)
  const top = Math.max(0, minY - pad)
  const right = Math.min(w - 1, maxX + pad)
  const bottom = Math.min(h - 1, maxY + pad)
  const cw = right - left + 1
  const ch = bottom - top + 1
  const cropped = document.createElement('canvas')
  cropped.width = cw
  cropped.height = ch
  const cctx = cropped.getContext('2d')
  if (!cctx) return sourceCanvas
  cctx.clearRect(0, 0, cw, ch)
  cctx.drawImage(sourceCanvas, left, top, cw, ch, 0, 0, cw, ch)
  return cropped
}

/**
 * Load payslip logo at natural resolution, strip black plate, crop,
 * then optionally downscale to targetPx (never upscale) for sharp PDF embed.
 */
async function loadTransparentPayslipLogo(logoUrl, targetW = 0, targetH = 0) {
  if (!logoUrl || typeof document === 'undefined') return ''

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const w = image.naturalWidth || image.width
        const h = image.naturalHeight || image.height
        if (!w || !h) return resolve('')
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve('')
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(image, 0, 0)
        removeNearBlackBackground(ctx, w, h)
        const cropped = cropToOpaqueBounds(canvas, 6)
        const cw = cropped.width
        const ch = cropped.height
        if (!targetW || !targetH || cw <= targetW || ch <= targetH) {
          resolve(cropped.toDataURL('image/png'))
          return
        }
        // Downscale only (never upscale) with high-quality smoothing.
        const scale = Math.min(targetW / cw, targetH / ch)
        const outW = Math.max(1, Math.round(cw * scale))
        const outH = Math.max(1, Math.round(ch * scale))
        const out = document.createElement('canvas')
        out.width = outW
        out.height = outH
        const octx = out.getContext('2d')
        if (!octx) return resolve(cropped.toDataURL('image/png'))
        octx.clearRect(0, 0, outW, outH)
        octx.imageSmoothingEnabled = true
        octx.imageSmoothingQuality = 'high'
        octx.drawImage(cropped, 0, 0, cw, ch, 0, 0, outW, outH)
        resolve(out.toDataURL('image/png'))
      } catch {
        resolve('')
      }
    }
    image.onerror = () => resolve('')
    image.src = logoUrl
  })
}

/**
 * Generate a payslip PDF via jspdf + autotable.
 * LoopC structured: compact header + logo + Employee / Salary / Deductions / Net Paid.
 * Other tenants: legacy full header + earned/paid/balance lines.
 * Presentation only — does not mutate payslip data.
 */
export async function generatePayslipPdf(payslip, tenant) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const branding = getTenantBranding(tenant)
  const structured = isStructuredPayrollEnabled(tenant)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageRight = pageWidth - margin
  const contentWidth = pageWidth - margin * 2
  let y = margin

  if (structured) {
    const logoW = 140
    const logoH = 45
    // 2× display pixels for sharper embed when source is larger than this.
    const embedPxW = Math.round(logoW * 2)
    const embedPxH = Math.round(logoH * 2)
    let logoAsset = await loadTransparentPayslipLogo('/logos/loopc-payslip-logo.png', embedPxW, embedPxH)
    if (!logoAsset || !String(logoAsset).startsWith('data:image/')) {
      const fallback = branding.logoUrl || branding.logoImage || ''
      if (fallback) {
        logoAsset = await loadTransparentPayslipLogo(fallback, embedPxW, embedPxH)
      }
    }
    if (logoAsset && String(logoAsset).startsWith('data:image/')) {
      try {
        doc.addImage(logoAsset, 'PNG', pageRight - logoW, margin - 4, logoW, logoH, undefined, 'NONE')
      } catch {
        // Leave reserved top-right space if embed fails.
      }
    }

    // Logo brands the page; no top-left LoopC text.
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYSLIP', margin, y)
    y = Math.max(y + 16, margin + logoH + 8)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    doc.text(`Payslip No: ${payslip.number || '—'}`, margin, y)
    y += 14
    doc.text(`Bank: ${payslip.bankMasked || '****'}`, margin, y)
    y += 16

    const colStyles = twoColStyles(contentWidth)

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
        ['Department', payslip.department || '—'],
        ['Joining Date', fmtDate(payslip.joiningDate)],
        ['Payroll Period', displayPeriodRange(payslip)],
        ['No. of Days', payslip.payableDays != null ? String(payslip.payableDays) : '—'],
      ],
      margin: { left: margin, right: margin },
      styles: TABLE_STYLES,
      columnStyles: colStyles,
      headStyles: { fillColor: HEAD_FILL },
      tableWidth: contentWidth,
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
      ],
      margin: { left: margin, right: margin },
      styles: TABLE_STYLES,
      columnStyles: colStyles,
      headStyles: { fillColor: HEAD_FILL },
      tableWidth: contentWidth,
    })
    y = doc.lastAutoTable.finalY + 14

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Deductions', margin, y)
    y += 6
    autoTable(doc, {
      startY: y,
      head: [['Deduction', 'Amount']],
      body: [
        ['Current Month Advance Payment Deduction', inrMoney(currentMonthAdvanceDeductionOf(payslip))],
        // Presentation alias of salaryBalance (unpaid residual) — not a second transaction
        ['Previous Month Advance Payment Deduction', inrMoney(previousMonthAdvanceDeductionOf(payslip))],
        ['Other Deductions', inrMoney(otherDeductionsOf(payslip))],
        ['Total Deductions', inrMoney(displayTotalDeductionsOf(payslip))],
      ],
      margin: { left: margin, right: margin },
      styles: TABLE_STYLES,
      columnStyles: colStyles,
      headStyles: { fillColor: HEAD_FILL },
      tableWidth: contentWidth,
    })
    y = doc.lastAutoTable.finalY + 14

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Total Amount']],
      body: [
        ['Net Paid / Amount Paid', inrMoney(payslip.amountPaid)],
      ],
      margin: { left: margin, right: margin },
      styles: { ...TABLE_STYLES, fontStyle: 'bold' },
      columnStyles: colStyles,
      headStyles: { fillColor: HEAD_FILL },
      tableWidth: contentWidth,
    })
    y = doc.lastAutoTable.finalY + 16

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
        styles: TABLE_STYLES,
        columnStyles: { 2: { halign: 'right' } },
        headStyles: { fillColor: HEAD_FILL },
        tableWidth: contentWidth,
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
