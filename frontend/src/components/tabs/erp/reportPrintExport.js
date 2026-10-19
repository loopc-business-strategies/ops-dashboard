import { clampBrandingDimension, createLogoRenderAsset } from './ERPBrandingUtils'
import {
  buildReportPdfColumnStyles,
  buildReportPdfMeta,
  buildReportPdfTable,
  buildReportPdfTableLayout,
  computeReportPdfPageHeight,
  isReportDataReady,
  renderReportPdfHeader,
  setReportPdfPageHeight,
  REPORT_PDF_MARGIN,
  REPORT_PDF_SUBTOTAL_ROW_FILL,
  REPORT_PDF_TABLE_FONT,
  REPORT_PDF_TABLE_PADDING,
  REPORT_PDF_TOTAL_ROW_FILL,
} from './reportExportHelpers'
import { trialBalanceRowsForView } from './trialBalanceReportRows'
import { DEFAULT_REPORT_MONEY_COLUMNS, reportMoneyHeaderLabels, trialMetalHeaders, trialMetalValues, trialMoneyHeaders, trialMoneyValues } from './reportDisplayOptions'
import { buildCurrencyBalanceSheetModel, buildCurrencyProfitLossModel, buildCurrencyTrialBalanceModel, formatTrialRange } from './currencyTrialBalanceExport'
import { getTenantBranding } from '../../../config/tenantBranding'
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

function renderReportPdfBody(autoTable, doc, {
  reportView,
  head,
  body,
  tableStartY,
  tableWidth,
  tableMarginLeft,
  tableMarginRight,
  margin,
  columns,
}) {
  autoTable(doc, {
    head,
    body,
    startY: tableStartY,
    tableWidth,
    styles: { fontSize: REPORT_PDF_TABLE_FONT, cellPadding: REPORT_PDF_TABLE_PADDING, overflow: 'linebreak' },
    bodyStyles: { valign: 'top' },
    headStyles: {
      fillColor: [17, 24, 39],
      fontSize: REPORT_PDF_TABLE_FONT,
      cellPadding: REPORT_PDF_TABLE_PADDING,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: buildReportPdfColumnStyles(reportView, tableWidth, columns),
    margin: { left: tableMarginLeft, right: tableMarginRight, bottom: margin },
    didParseCell: (data) => {
      const rowLabel = String(data.row?.raw?.[0] || '')
      if (rowLabel === 'Subtotal') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = REPORT_PDF_SUBTOTAL_ROW_FILL
      }
      if (rowLabel === 'Total') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = REPORT_PDF_TOTAL_ROW_FILL
      }
    },
  })
}

function createPortraitA4Pdf(jsPDF) {
  return new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
}

async function renderReportPdfLogo(doc, pageWidth, margin, branding, defaultBranding, logoAsset) {
  const logoWidth = clampBrandingDimension(branding.logoWidth, defaultBranding.logoWidth, 48, 72)
  const logoHeight = clampBrandingDimension(branding.logoHeight, defaultBranding.logoHeight, 20, 28)
  const processedLogo = logoAsset ?? await createLogoRenderAsset(branding.logoUrl, logoWidth, logoHeight, branding.logoFit)
  if (processedLogo && String(processedLogo).startsWith('data:image/')) {
    try {
      doc.addImage(processedLogo, 'PNG', pageWidth - margin - logoWidth, 18, logoWidth, logoHeight, undefined, 'FAST')
    } catch {
      // Ignore invalid embedded image data and continue without logo.
    }
  }
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
  columns = DEFAULT_REPORT_MONEY_COLUMNS,
  suppressSummary = false,
  displayCurrency = '',
  convertAmount,
  baseCurrency = 'USD',
}) {
  if (!isReportDataReady(reportView, reports, ledgerReportRows)) return null
  const { title, periodText } = buildReportPdfMeta({
    reportView,
    reports,
    selectedReportAccountCode,
    formatMoney,
    includeSummary: !suppressSummary,
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
        ${suppressSummary ? '' : `<div class="summary">
          <div class="card"><div class="card-label">Income</div><div class="card-value">${formatMoney(reports.profitLoss?.totalIncome)}</div></div>
          <div class="card"><div class="card-label">Expense</div><div class="card-value">${formatMoney(reports.profitLoss?.totalExpense)}</div></div>
          <div class="card"><div class="card-label">Net Profit</div><div class="card-value">${formatMoney(reports.profitLoss?.netProfit)}</div></div>
        </div>`}
        <div class="section"><p class="section-title">Income Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.incomeBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        <div class="section"><p class="section-title">Expense Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.expenseBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        <div class="section"><p class="section-title">Purchases and sales</p><table><thead><tr><th>Type</th><th>Doc No</th><th>Date</th><th>Party</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.metalVouchers?.vouchers || []).map((row) => `<tr><td>${row.type === 'sale' ? 'Sale' : 'Purchase'}</td><td>${row.vocNo || ''}</td><td>${row.date ? String(row.date).slice(0, 10) : ''}</td><td>${[row.partyCode, row.partyName].filter(Boolean).join(' ')}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}<tr><td colspan="4">Total sales</td><td class="num">${formatMoney(reports.profitLoss?.metalVouchers?.totalSales)}</td></tr><tr><td colspan="4">Total purchases</td><td class="num">${formatMoney(reports.profitLoss?.metalVouchers?.totalPurchases)}</td></tr></tbody></table></div>
        ${signatureBlock}
      `
  }
  if (reportView === 'balanceSheet') {
    const section = (sectionTitle, rows, fallbackDirection) => `<div class="section"><p class="section-title">${sectionTitle}</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Balance</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}</td><td class="num">${formatReportDirectionalBalance(row, fallbackDirection)}</td></tr>`).join('')}</tbody></table></div>`
    return `
        ${head}
        ${suppressSummary ? '' : `<div class="summary">
          <div class="card"><div class="card-label">Assets</div><div class="card-value">${formatMoneyAbs(reports.balanceSheet?.totalAssets)}</div></div>
          <div class="card"><div class="card-label">Liabilities + Equity</div><div class="card-value">${formatMoneyAbs(reports.balanceSheet?.liabilitiesPlusEquity)}</div></div>
          <div class="card"><div class="card-label">Working Capital</div><div class="card-value">${formatMoney(reports.balanceSheet?.workingCapital)}</div></div>
        </div>`}
        ${section('Assets', reports.balanceSheet?.assets || [], 'Dr')}
        ${section('Liabilities', reports.balanceSheet?.liabilities || [], 'Cr')}
        ${section('Equity', reports.balanceSheet?.equity || [], 'Cr')}
        ${signatureBlock}
      `
  }
  if (reportView === 'summary') {
    const rows = trialBalanceRowsForView('summary', reports.trialBalance?.trialBalance || [])
    const model = buildCurrencyTrialBalanceModel({
      rows,
      convert: convertAmount || ((value) => Number(value || 0)),
      baseCurrency,
      displayCurrency: displayCurrency || baseCurrency,
    })
    const headers = model.head[0] || []
    return `
        ${head}
        ${suppressSummary ? '' : `<div class="summary">
          <div class="card"><div class="card-label">Trial Debit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalDebit)}</div></div>
          <div class="card"><div class="card-label">Trial Credit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalCredit)}</div></div>
          <div class="card"><div class="card-label">Difference</div><div class="card-value">${formatMoney(reports.trialBalance?.difference)}</div></div>
        </div>`}
        <div class="section"><p class="section-title">${title}</p><table><thead><tr>${headers.map((label, index) => `<th${index >= 3 ? ' class="num"' : ''}>${escapePrintCell(label)}</th>`).join('')}</tr></thead><tbody>${model.body.map((row, rowIndex) => {
          const kind = model.kinds[rowIndex]
          const strong = kind && kind !== 'account'
          return `<tr>${row.map((cell, col) => `<td${strong ? ' style="font-weight:700;"' : ''}${col >= 3 ? ' class="num"' : ''}>${escapePrintCell(cell)}</td>`).join('')}</tr>`
        }).join('')}</tbody></table></div>
        ${signatureBlock}
      `
  }
  return `
        ${head}
        ${suppressSummary ? '' : `<div class="summary">
          <div class="card"><div class="card-label">Trial Debit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalDebit)}</div></div>
          <div class="card"><div class="card-label">Trial Credit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalCredit)}</div></div>
          <div class="card"><div class="card-label">Difference</div><div class="card-value">${formatMoney(reports.trialBalance?.difference)}</div></div>
        </div>`}
        <div class="section"><p class="section-title">${title}</p><table><thead><tr><th>Code</th><th>Account</th><th>Type</th>${trialMoneyHeaders(columns, reportMoneyHeaderLabels(displayCurrency)).map((label) => `<th class="num">${label}</th>`).join('')}${trialMetalHeaders(columns.showMetal).map((label) => `<th class="num">${label}</th>`).join('')}</tr></thead><tbody>${trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td>${row.accountType}</td>${trialMoneyValues(row, columns, formatMoney).map((value) => `<td class="num">${value}</td>`).join('')}${trialMetalValues(row, columns.showMetal).map((value) => `<td class="num">${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
}

function escapePrintCell(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function trialCompanyBlock(branding = {}, defaultBranding = {}, user = {}) {
  const hostTenant = typeof window !== 'undefined' ? String(window.location.hostname || '').split('.')[0] : ''
  const tenant = getTenantBranding(user?.company || user?.tenant?.key || user?.tenant?.name || hostTenant)
  const savedName = String(branding.companyName || '').trim()
  const fallbackName = String(defaultBranding.companyName || '').trim()
  const companyName = !savedName || savedName === fallbackName
    ? (tenant.companyName || tenant.displayName || savedName || fallbackName)
    : savedName
  const address = String(branding.address || tenant.address || '').trim()
  const phone = String(branding.phone || tenant.phone || '').trim()
  return { companyName, address, phone, logoUrl: branding.logoUrl || tenant.logoUrl || '' }
}

function drawCurrencyTrialHeader(doc, {
  title,
  companyName,
  address,
  phone,
  periodLabel,
  accountTypeLabel,
  logoAsset,
}) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 28
  const top = 22
  const height = 78
  doc.setDrawColor(180, 190, 180)
  doc.setLineWidth(0.8)
  doc.roundedRect(margin, top, pageWidth - margin * 2, height, 6, 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text(title || 'CURRENCY TRIAL BALANCE (TILL DATE)', margin + 12, top + 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(55, 65, 81)
  doc.text(periodLabel || '', margin + 12, top + 36)
  doc.text(`Account Type : ${accountTypeLabel || 'All'}`, margin + 12, top + 50)
  const right = pageWidth - margin - 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text(companyName || '', right, top + 20, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(55, 65, 81)
  const lines = String(address || '').split(/\n/).map((line) => line.trim()).filter(Boolean)
  if (phone) lines.push(`Tel : ${phone}`)
  lines.slice(0, 4).forEach((line, index) => {
    doc.text(line, right, top + 34 + index * 10, { align: 'right' })
  })
  if (logoAsset && String(logoAsset).startsWith('data:image/')) {
    try {
      doc.addImage(logoAsset, 'PNG', margin + 12, top + 54, 36, 16, undefined, 'FAST')
    } catch {
      // A bad logo file still leaves the company name in the header.
    }
  }
  return top + height + 12
}

async function exportCurrencyTrialBalancePdf({
  reports,
  branding,
  defaultBranding,
  user,
  displayCurrency,
  baseCurrency,
  convertAmount,
  rowView = 'trial',
  title,
  fileBase = 'currency-trial-balance',
}) {
  const { jsPDF, autoTable } = await loadPdfTools()
  const rows = trialBalanceRowsForView(rowView, reports.trialBalance?.trialBalance || [])
  const model = buildCurrencyTrialBalanceModel({
    rows,
    convert: convertAmount || ((value) => Number(value || 0)),
    baseCurrency,
    displayCurrency: displayCurrency || baseCurrency,
  })
  const company = trialCompanyBlock(branding, defaultBranding, user)
  const logo = await createLogoRenderAsset(company.logoUrl, 120, 48, branding?.logoFit || 'contain')
  const periodLabel = formatTrialRange(reports.trialBalance?.period)
  const types = [...new Set(rows.map((row) => row.accountType).filter(Boolean))]
  const accountTypeLabel = types.length === 1 ? types[0] : 'All'
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 28
  const printedOn = new Date().toLocaleString()
  const printedBy = user?.name || user?.username || 'User'
  autoTable(doc, {
    head: model.pdfHead,
    body: model.body,
    startY: 112,
    margin: { left: margin, right: margin, top: 112, bottom: 32 },
    styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [217, 234, 211], textColor: [17, 24, 39], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const kind = model.kinds[data.row.index]
      if (kind === 'section' || kind === 'group') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [232, 240, 228]
      }
      if (kind === 'subtotal' || kind === 'result') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [217, 234, 211]
      }
      if (kind === 'total') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [182, 215, 168]
      }
    },
    didDrawPage: () => {
      drawCurrencyTrialHeader(doc, { title: title || model.title, ...company, periodLabel, accountTypeLabel, logoAsset: logo })
    },
  })
  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(75, 85, 99)
    doc.text(`Printed By : ${printedBy}`, margin, pageHeight - 16)
    doc.text(`Printed On : ${printedOn}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`${fileBase}-${stamp}.pdf`)
}

async function exportCurrencyProfitLossPdf({
  reports,
  branding,
  defaultBranding,
  user,
  displayCurrency,
  baseCurrency,
  convertAmount,
}) {
  const profitLoss = reports.profitLoss || {}
  const model = buildCurrencyProfitLossModel({
    income: profitLoss.incomeBreakdown || [],
    expenses: profitLoss.expenseBreakdown || [],
    convert: convertAmount || ((value) => Number(value || 0)),
    baseCurrency,
    displayCurrency: displayCurrency || baseCurrency,
  })
  const company = trialCompanyBlock(branding, defaultBranding, user)
  const logo = await createLogoRenderAsset(company.logoUrl, 120, 48, branding?.logoFit || 'contain')
  const periodLabel = formatTrialRange(profitLoss.period)
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 28
  const printedOn = new Date().toLocaleString()
  const printedBy = user?.name || user?.username || 'User'
  autoTable(doc, {
    head: model.pdfHead,
    body: model.body,
    startY: 112,
    margin: { left: margin, right: margin, top: 112, bottom: 32 },
    styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [217, 234, 211], textColor: [17, 24, 39], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const kind = model.kinds[data.row.index]
      if (kind === 'section' || kind === 'group') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [232, 240, 228]
      }
      if (kind === 'subtotal' || kind === 'result') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [217, 234, 211]
      }
      if (kind === 'total') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [182, 215, 168]
      }
    },
    didDrawPage: () => {
      drawCurrencyTrialHeader(doc, { title: model.title, ...company, periodLabel, accountTypeLabel: 'All', logoAsset: logo })
    },
  })
  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(75, 85, 99)
    doc.text(`Printed By : ${printedBy}`, margin, pageHeight - 16)
    doc.text(`Printed On : ${printedOn}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`currency-profit-loss-${stamp}.pdf`)
}

async function exportCurrencyBalanceSheetPdf({
  reports,
  branding,
  defaultBranding,
  user,
  displayCurrency,
  baseCurrency,
  convertAmount,
  period,
}) {
  const sheet = reports.balanceSheet || {}
  const model = buildCurrencyBalanceSheetModel({
    assets: sheet.assets || [],
    liabilities: sheet.liabilities || [],
    equity: sheet.equity || [],
    convert: convertAmount || ((value) => Number(value || 0)),
    baseCurrency,
    displayCurrency: displayCurrency || baseCurrency,
  })
  const company = trialCompanyBlock(branding, defaultBranding, user)
  const logo = await createLogoRenderAsset(company.logoUrl, 120, 48, branding?.logoFit || 'contain')
  const asOfMatch = String(sheet.asOfDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  const periodLabel = formatTrialRange(period) || (asOfMatch ? `As at ${asOfMatch[3]}/${asOfMatch[2]}/${asOfMatch[1]}` : '')
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 28
  const printedOn = new Date().toLocaleString()
  const printedBy = user?.name || user?.username || 'User'
  autoTable(doc, {
    head: model.pdfHead,
    body: model.body,
    startY: 112,
    margin: { left: margin, right: margin, top: 112, bottom: 32 },
    styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [217, 234, 211], textColor: [17, 24, 39], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const kind = model.kinds[data.row.index]
      if (kind === 'section' || kind === 'group') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [232, 240, 228]
      }
      if (kind === 'subtotal' || kind === 'result') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [217, 234, 211]
      }
      if (kind === 'total') {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [182, 215, 168]
      }
    },
    didDrawPage: () => {
      drawCurrencyTrialHeader(doc, { title: model.title, ...company, periodLabel, accountTypeLabel: 'All', logoAsset: logo })
    },
  })
  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(75, 85, 99)
    doc.text(`Printed By : ${printedBy}`, margin, pageHeight - 16)
    doc.text(`Printed On : ${printedOn}`, pageWidth / 2, pageHeight - 16, { align: 'center' })
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: 'right' })
  }
  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`currency-balance-sheet-${stamp}.pdf`)
}

export async function exportReportPdf({
  reportView,
  reports,
  branding,
  defaultBranding,
  user: _user,
  ledgerReportRows,
  selectedReportAccountCode,
  formatMoney,
  formatReportDirectionalBalance,
  columns = DEFAULT_REPORT_MONEY_COLUMNS,
  suppressSummary = false,
  displayCurrency = '',
  baseCurrency = 'USD',
  convertAmount,
  period,
}) {
  if (reportView === 'trial' || reportView === 'summary') {
    await exportCurrencyTrialBalancePdf({
      reports,
      branding,
      defaultBranding,
      user: _user,
      displayCurrency,
      baseCurrency,
      convertAmount,
      rowView: reportView,
      title: reportView === 'summary' ? 'SUMMARY' : undefined,
      fileBase: reportView === 'summary' ? 'summary' : 'currency-trial-balance',
    })
    return
  }
  if (reportView === 'pnl') {
    await exportCurrencyProfitLossPdf({
      reports,
      branding,
      defaultBranding,
      user: _user,
      displayCurrency,
      baseCurrency,
      convertAmount,
    })
    return
  }
  if (reportView === 'balanceSheet') {
    await exportCurrencyBalanceSheetPdf({
      reports,
      branding,
      defaultBranding,
      user: _user,
      displayCurrency,
      baseCurrency,
      convertAmount,
      period,
    })
    return
  }
  const { jsPDF, autoTable } = await loadPdfTools()
  const margin = REPORT_PDF_MARGIN

  const { title, periodText, summaryLines, fileBase } = buildReportPdfMeta({
    reportView,
    reports,
    selectedReportAccountCode,
    formatMoney,
    includeSummary: !suppressSummary,
  })
  const { head, body } = buildReportPdfTable({
    reportView,
    reports,
    ledgerReportRows,
    formatMoney,
    formatReportDirectionalBalance,
    forPdf: true,
    columns,
    displayCurrency,
  })

  const headerOptions = { title, periodText, summaryLines, compact: true }
  const measureDoc = createPortraitA4Pdf(jsPDF)
  const measurePageWidth = measureDoc.internal.pageSize.getWidth()
  const measureLayout = buildReportPdfTableLayout(measurePageWidth, margin)
  const measureTableMarginRight = measurePageWidth - measureLayout.tableMarginLeft - measureLayout.tableWidth
  const measureTableStartY = renderReportPdfHeader(measureDoc, headerOptions)
  renderReportPdfBody(autoTable, measureDoc, {
    reportView,
    head,
    body,
    tableStartY: measureTableStartY,
    tableWidth: measureLayout.tableWidth,
    tableMarginLeft: measureLayout.tableMarginLeft,
    tableMarginRight: measureTableMarginRight,
    margin,
    columns,
  })

  const multiPage = measureDoc.internal.getNumberOfPages() > 1
  const doc = createPortraitA4Pdf(jsPDF)
  if (!multiPage) {
    const contentEndY = measureDoc.lastAutoTable?.finalY || measureTableStartY
    setReportPdfPageHeight(doc, computeReportPdfPageHeight(contentEndY))
  }

  const pageWidth = doc.internal.pageSize.getWidth()
  const { tableWidth, tableMarginLeft } = buildReportPdfTableLayout(pageWidth, margin)
  const tableMarginRight = pageWidth - tableMarginLeft - tableWidth

  const logoWidth = clampBrandingDimension(branding.logoWidth, defaultBranding.logoWidth, 48, 72)
  const logoHeight = clampBrandingDimension(branding.logoHeight, defaultBranding.logoHeight, 20, 28)
  const processedLogo = await createLogoRenderAsset(branding.logoUrl, logoWidth, logoHeight, branding.logoFit)
  await renderReportPdfLogo(doc, pageWidth, margin, branding, defaultBranding, processedLogo)

  const tableStartY = renderReportPdfHeader(doc, headerOptions)
  renderReportPdfBody(autoTable, doc, {
    reportView,
    head,
    body,
    tableStartY,
    tableWidth,
    tableMarginLeft,
    tableMarginRight,
    margin,
    columns,
  })

  doc.save(`${fileBase}.pdf`)
}

export async function exportTransactionsPdf({ scope, transactionTypeLabels, baseCurrencyCode = 'USD' }) {
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
    body: buildTransactionsPdfTableBody(scope, transactionTypeLabels, baseCurrencyCode),
    startY: 84,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 24, right: 24 },
  })
  doc.save(`transactions-${new Date().toISOString().slice(0, 10)}.pdf`)
}
