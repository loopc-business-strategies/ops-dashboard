import { clampBrandingDimension, createLogoRenderAsset } from './ERPBrandingUtils'
import { trialBalanceRowsForView } from './trialBalanceReportRows'
import { loadPdfTools } from './lazyExportLibs'

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
}) {
  if (!reports.trialBalance) return null
  const periodText = reports.trialBalance?.period?.startDate
    ? `${reports.trialBalance.period.startDate} to ${reports.trialBalance.period.endDate || reports.trialBalance.period.startDate}`
    : `As on ${new Date().toLocaleDateString()}`
  const logoMarkup = await buildBrandingLogoTag(branding, 'margin-bottom:10px;')
  const head = `
      <div class="brandbar"></div>
      <div class="head">
        ${logoMarkup}
        <p class="subtitle">${branding.companyName || defaultBranding.companyName}</p>
        <p class="title">ERP Financial Statement</p>
        <p class="meta">${branding.entityName || defaultBranding.entityName}${branding.branchName ? ` / ${branding.branchName}` : ''}</p>
        ${branding.legalName ? `<p class="meta">${branding.legalName}</p>` : ''}
        <p class="meta">${branding.reportSubtitle || defaultBranding.reportSubtitle} | Prepared for statutory / CA-style review</p>
        <p class="meta">Period: ${periodText}</p>
        <p class="meta">Generated: ${new Date().toLocaleString()}</p>
      </div>
    `
  const signatureBlock = `
      <div class="signatures">
        <div class="sign-box">${branding.preparedByTitle || defaultBranding.preparedByTitle}<br />${branding.preparedByName || user?.name || defaultBranding.preparedByName}</div>
        <div class="sign-box">${branding.reviewedByTitle || defaultBranding.reviewedByTitle}<br />${branding.reviewedByName || defaultBranding.reviewedByName}</div>
        <div class="sign-box">${branding.approvedByTitle || defaultBranding.approvedByTitle}<br />${branding.approvedByName || defaultBranding.approvedByName}</div>
      </div>
      <div class="footer">
        <span>${branding.companyName || defaultBranding.companyName} Reporting Suite</span>
        <span>${branding.reportFooter || defaultBranding.reportFooter}</span>
      </div>
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
    const section = (title, rows, fallbackDirection) => `<div class="section"><p class="section-title">${title}</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Balance</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}</td><td class="num">${formatReportDirectionalBalance(row, fallbackDirection)}</td></tr>`).join('')}</tbody></table></div>`
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
        <div class="section"><p class="section-title">${reportView === 'summary' ? 'Summary' : 'Trial Balance'}</p><table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead><tbody>${trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td>${row.accountType}</td><td class="num">${formatMoney(row.debit)}</td><td class="num">${formatMoney(row.credit)}</td><td class="num">${formatMoney(row.net)}</td></tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
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
  const titleMap = {
    summary: 'Summary',
    trial: 'Trial Balance',
    pnl: 'Profit & Loss Statement',
    balanceSheet: 'Balance Sheet',
    dayBook: 'Day Book',
    outstanding: 'Outstanding Statement',
    forex: 'Forex Gain/Loss',
    ledger: `Ledger Drilldown ${selectedReportAccountCode ? `- ${selectedReportAccountCode}` : ''}`,
  }
  const title = titleMap[reportView] || 'ERP Report'
  const logoWidth = clampBrandingDimension(branding.logoWidth, defaultBranding.logoWidth, 80, 260)
  const logoHeight = clampBrandingDimension(branding.logoHeight, defaultBranding.logoHeight, 32, 120)
  const processedLogo = await createLogoRenderAsset(branding.logoUrl, logoWidth, logoHeight, branding.logoFit)
  doc.setFillColor(0, 104, 74)
  doc.rect(28, 24, 539, 10, 'F')
  if (processedLogo && String(processedLogo).startsWith('data:image/')) {
    try {
      doc.addImage(processedLogo, 'PNG', 540 - logoWidth, 36, logoWidth, logoHeight, undefined, 'FAST')
    } catch {
      // Ignore invalid embedded image data and continue with text branding.
    }
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(6, 95, 70)
  doc.text(String(branding.companyName || defaultBranding.companyName).toUpperCase(), 40, 52)
  doc.setFontSize(16)
  doc.setTextColor(17, 24, 39)
  doc.text(title, 40, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  if (branding.legalName) doc.text(String(branding.legalName), 40, 64)
  doc.text(`${branding.entityName || defaultBranding.entityName}${branding.branchName ? ` / ${branding.branchName}` : ''}`, 40, branding.legalName ? 78 : 64)
  doc.text(String(branding.reportSubtitle || defaultBranding.reportSubtitle), 40, branding.legalName ? 92 : 78)
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, branding.legalName ? 106 : 92)
  let head = []
  let body = []
  if (reportView === 'trial' || reportView === 'summary') {
    head = [['Code', 'Account', 'Type', 'Debit', 'Credit', 'Net']]
    body = trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || []).map((row) => [
      row.accountCode,
      row.accountName,
      row.accountType,
      formatMoney(row.debit),
      formatMoney(row.credit),
      formatMoney(row.net),
    ])
  } else if (reportView === 'pnl') {
    head = [['Section', 'Code', 'Account', 'Amount']]
    body = [
      ...(reports.profitLoss?.incomeBreakdown || []).map((row) => ['Income', row.accountCode, row.accountName, formatMoney(row.amount)]),
      ...(reports.profitLoss?.expenseBreakdown || []).map((row) => ['Expense', row.accountCode, row.accountName, formatMoney(row.amount)]),
      ['Total', 'NET', 'Net Profit', formatMoney(reports.profitLoss?.netProfit)],
    ]
  } else if (reportView === 'balanceSheet') {
    head = [['Section', 'Code', 'Account', 'Balance']]
    body = [
      ...(reports.balanceSheet?.assets || []).map((row) => ['Asset', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Dr')]),
      ...(reports.balanceSheet?.liabilities || []).map((row) => ['Liability', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Cr')]),
      ...(reports.balanceSheet?.equity || []).map((row) => ['Equity', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Cr')]),
    ]
  } else if (reportView === 'dayBook') {
    head = [['Date', 'Type', 'Description', 'Debit A/C', 'Credit A/C', 'Amount']]
    body = (reports.dayBook?.entries || []).map((row) => [
      new Date(row.date).toLocaleString(),
      row.referenceType,
      row.description || '',
      row.debitAccountId?.accountCode || '',
      row.creditAccountId?.accountCode || '',
      formatMoney(row.amount),
    ])
  } else if (reportView === 'outstanding') {
    head = [['Party', 'Name', 'Ledger', 'Outstanding', 'Age/Type']]
    body = [
      ...(reports.customerOutstanding?.rows || []).map((row) => ['Customer', row.customerName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), `90+: ${formatMoney(row.aging?.bucket90Plus || 0)}`]),
      ...(reports.vendorOutstanding?.rows || []).map((row) => ['Vendor', row.vendorName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), row.outstandingType || '']),
    ]
  } else if (reportView === 'forex') {
    head = [['Currency', 'Entries', 'Impact']]
    body = Object.entries(reports.forex?.byCurrency || {}).map(([currency, row]) => [currency, String(row.count || 0), formatMoney(row.impact)])
  } else if (reportView === 'ledger') {
    head = [['Voucher', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Running']]
    body = (ledgerReportRows || []).map((row) => [
      String(row.entryId || '').slice(-6).toUpperCase(),
      new Date(row.date).toLocaleString(),
      row.referenceType,
      row.description || '',
      formatMoney(row.debit),
      formatMoney(row.credit),
      formatMoney(row.runningBalance),
    ])
  }
  autoTable(doc, {
    head,
    body,
    startY: branding.legalName ? 122 : 108,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 28, right: 28 },
  })
  const finalY = doc.lastAutoTable?.finalY || 110
  const signatureY = Math.min(Math.max(finalY + 36, 680), 740)
  doc.setDrawColor(156, 163, 175)
  doc.line(40, signatureY, 180, signatureY)
  doc.line(220, signatureY, 360, signatureY)
  doc.line(400, signatureY, 540, signatureY)
  doc.setFontSize(9)
  doc.text(String(branding.preparedByTitle || defaultBranding.preparedByTitle), 40, signatureY + 14)
  doc.text(String(branding.preparedByName || user?.name || defaultBranding.preparedByName), 40, signatureY + 28)
  doc.text(String(branding.reviewedByTitle || defaultBranding.reviewedByTitle), 220, signatureY + 14)
  doc.text(String(branding.reviewedByName || defaultBranding.reviewedByName), 220, signatureY + 28)
  doc.text(String(branding.approvedByTitle || defaultBranding.approvedByTitle), 400, signatureY + 14)
  doc.text(String(branding.approvedByName || defaultBranding.approvedByName), 400, signatureY + 28)
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  doc.text(`${branding.companyName || defaultBranding.companyName} Reporting Suite`, 40, signatureY + 52)
  doc.text(String(branding.reportFooter || defaultBranding.reportFooter), 420, signatureY + 52)
  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}.pdf`)
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
