import { clampBrandingDimension, createLogoRenderAsset } from './ERPBrandingUtils'
import {
  buildReportPdfColumnStyles,
  buildReportPdfMeta,
  buildReportPdfTable,
  isReportDataReady,
  renderReportPdfHeader,
  REPORT_PDF_MARGIN,
  REPORT_PDF_TABLE_FONT,
  REPORT_PDF_TABLE_PADDING,
} from './reportExportHelpers'
import { trialBalanceRowsForView } from './trialBalanceReportRows'
import { loadPdfTools } from './lazyExportLibs'

function buildReportPrintHead({ reportTitle, periodText, logoMarkup }) {
  return `
      <div class="brandbar"></div>
      <div class="head">
        ${logoMarkup}
        <p class="title">${reportTitle}</p>
        <p class="meta">Period: ${periodText}</p>
        <p class="meta">Generated: ${new Date().toLocaleString()}</p>
      </div>
    `
}

export async function buildReportPrintHtml({
  reportView,
  reports,
  branding,
  defaultBranding,
  user,
  formatMoney,
  formatMoneyAbs,
  formatReportDirectionalBalance,
  buildBrandingLogoTag,
  ledgerReportRows = [],
  selectedReportAccountCode = '',
}) {
  if (!isReportDataReady(reportView, reports, ledgerReportRows)) return null
  const { title, periodText } = buildReportPdfMeta({
    reportView,
    reports,
    selectedReportAccountCode,
  })
  const logoMarkup = await buildBrandingLogoTag(branding, 'margin-bottom:10px;')
  const head = buildReportPrintHead({ reportTitle: title, periodText, logoMarkup })
  const signatureBlock = `
      <div class="signatures">
        <div class="sign-box">${branding.preparedByTitle || defaultBranding.preparedByTitle}<br />${branding.preparedByName || user?.name || defaultBranding.preparedByName}</div>
        <div class="sign-box">${branding.reviewedByTitle || defaultBranding.reviewedByTitle}<br />${branding.reviewedByName || defaultBranding.reviewedByName}</div>
        <div class="sign-box">${branding.approvedByTitle || defaultBranding.approvedByTitle}<br />${branding.approvedByName || defaultBranding.approvedByName}</div>
      </div>
      ${branding.reportFooter || defaultBranding.reportFooter ? `<div class="footer"><span>${branding.reportFooter || defaultBranding.reportFooter}</span></div>` : ''}
    `
  if (reportView === 'pnl') {
    return `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Income</div><div class="card-value">${formatMoney(reports.profitLoss?.totalIncome)}</div></div>
          <div class="card"><div class="card-label">Expense</div><div class="card-value">${formatMoney(reports.profitLoss?.totalExpense)}</div></div>
          <div class="card"><div class="card-label">Net Profit</div><div class="card-value">${formatMoney(reports.profitLoss?.netProfit)}</div></div>
        </div>
        <div class="section"><p class="section-title">Income Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.incomeBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        <div class="section"><p class="section-title">Expense Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.expenseBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
  }
  if (reportView === 'balanceSheet') {
    const section = (sectionTitle, rows, fallbackDirection) => `<div class="section"><p class="section-title">${sectionTitle}</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Balance</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}</td><td class="num">${formatReportDirectionalBalance(row, fallbackDirection)}</td></tr>`).join('')}</tbody></table></div>`
    return `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Assets</div><div class="card-value">${formatMoneyAbs(reports.balanceSheet?.totalAssets)}</div></div>
          <div class="card"><div class="card-label">Liabilities + Equity</div><div class="card-value">${formatMoneyAbs(reports.balanceSheet?.liabilitiesPlusEquity)}</div></div>
          <div class="card"><div class="card-label">Working Capital</div><div class="card-value">${formatMoney(reports.balanceSheet?.workingCapital)}</div></div>
        </div>
        ${section('Assets', reports.balanceSheet?.assets || [], 'Dr')}
        ${section('Liabilities', reports.balanceSheet?.liabilities || [], 'Cr')}
        ${section('Equity', reports.balanceSheet?.equity || [], 'Cr')}
        ${signatureBlock}
      `
  }
  return `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Trial Debit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalDebit)}</div></div>
          <div class="card"><div class="card-label">Trial Credit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalCredit)}</div></div>
          <div class="card"><div class="card-label">Difference</div><div class="card-value">${formatMoney(reports.trialBalance?.difference)}</div></div>
        </div>
        <div class="section"><p class="section-title">${title}</p><table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead><tbody>${trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td>${row.accountType}</td><td class="num">${formatMoney(row.debit)}</td><td class="num">${formatMoney(row.credit)}</td><td class="num">${formatMoney(row.net)}</td></tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
}

function renderReportPdfSignatures(doc, {
  branding,
  defaultBranding,
  user,
  startY,
}) {
  const margin = REPORT_PDF_MARGIN
  const pageHeight = doc.internal.pageSize.getHeight()
  let signatureY = startY + 24
  const blockHeight = 56

  if (signatureY + blockHeight > pageHeight - margin) {
    doc.addPage()
    signatureY = margin + 16
  }

  doc.setDrawColor(156, 163, 175)
  doc.line(margin + 8, signatureY, margin + 148, signatureY)
  doc.line(margin + 188, signatureY, margin + 328, signatureY)
  doc.line(margin + 368, signatureY, margin + 508, signatureY)
  doc.setFontSize(8)
  doc.setTextColor(17, 24, 39)
  doc.text(String(branding.preparedByTitle || defaultBranding.preparedByTitle), margin + 8, signatureY + 12)
  doc.text(String(branding.preparedByName || user?.name || defaultBranding.preparedByName), margin + 8, signatureY + 24)
  doc.text(String(branding.reviewedByTitle || defaultBranding.reviewedByTitle), margin + 188, signatureY + 12)
  doc.text(String(branding.reviewedByName || defaultBranding.reviewedByName), margin + 188, signatureY + 24)
  doc.text(String(branding.approvedByTitle || defaultBranding.approvedByTitle), margin + 368, signatureY + 12)
  doc.text(String(branding.approvedByName || defaultBranding.approvedByName), margin + 368, signatureY + 24)

  const footer = String(branding.reportFooter || defaultBranding.reportFooter || '').trim()
  if (footer) {
    doc.setFontSize(7)
    doc.setTextColor(107, 114, 128)
    doc.text(footer, margin + 8, signatureY + 42)
  }
}

export async function exportReportPdf({
  reportView,
  reports,
  branding,
  defaultBranding,
  user,
  ledgerReportRows,
  selectedReportAccountCode,
  formatMoney,
  formatReportDirectionalBalance,
}) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const margin = REPORT_PDF_MARGIN
  const pageWidth = doc.internal.pageSize.getWidth()
  const tableWidth = pageWidth - margin * 2

  const { title, periodText, summaryLines, fileBase } = buildReportPdfMeta({
    reportView,
    reports,
    selectedReportAccountCode,
  })
  const { head, body } = buildReportPdfTable({
    reportView,
    reports,
    ledgerReportRows,
    formatMoney,
    formatReportDirectionalBalance,
    forPdf: true,
  })

  const logoWidth = clampBrandingDimension(branding.logoWidth, defaultBranding.logoWidth, 48, 72)
  const logoHeight = clampBrandingDimension(branding.logoHeight, defaultBranding.logoHeight, 20, 28)
  const processedLogo = await createLogoRenderAsset(branding.logoUrl, logoWidth, logoHeight, branding.logoFit)
  if (processedLogo && String(processedLogo).startsWith('data:image/')) {
    try {
      doc.addImage(processedLogo, 'PNG', pageWidth - margin - logoWidth, 18, logoWidth, logoHeight, undefined, 'FAST')
    } catch {
      // Ignore invalid embedded image data and continue without logo.
    }
  }

  const tableStartY = renderReportPdfHeader(doc, { title, periodText, summaryLines, compact: true })

  autoTable(doc, {
    head,
    body,
    startY: tableStartY,
    tableWidth,
    styles: { fontSize: REPORT_PDF_TABLE_FONT, cellPadding: REPORT_PDF_TABLE_PADDING, overflow: 'linebreak' },
    bodyStyles: { valign: 'top' },
    headStyles: { fillColor: [17, 24, 39], fontSize: REPORT_PDF_TABLE_FONT, cellPadding: REPORT_PDF_TABLE_PADDING },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: buildReportPdfColumnStyles(reportView, tableWidth),
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      const rowLabel = String(data.row?.raw?.[0] || '')
      if (['Subtotal', 'Total'].includes(rowLabel)) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [243, 244, 246]
      }
    },
  })

  const finalY = doc.lastAutoTable?.finalY || tableStartY
  renderReportPdfSignatures(doc, {
    branding,
    defaultBranding,
    user,
    startY: finalY,
  })

  doc.save(`${fileBase}.pdf`)
}

export async function exportTransactionsPdf({ scope, transactionTypeLabels }) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const { buildTransactionsPdfTableBody } = await import('./transactionExportHelpers')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ERP Transactions Register', 36, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 36, 54)
  autoTable(doc, {
    head: [['Date', 'Type', 'Party', 'Amount', 'Status', 'Description', 'Comments', 'Audit']],
    body: buildTransactionsPdfTableBody(scope, transactionTypeLabels),
    startY: 84,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 24, right: 24 },
  })
  doc.save(`transactions-${new Date().toISOString().slice(0, 10)}.pdf`)
}
