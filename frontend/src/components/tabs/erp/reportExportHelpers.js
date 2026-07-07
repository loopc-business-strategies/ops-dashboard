/**
 * Pure builders for ERP financial report exports (CSV/XLSX/PDF row grids).
 */

import { trialBalanceRowsForView } from './trialBalanceReportRows'

const REPORT_VIEW_LABELS = {
  summary: 'Summary',
  trial: 'Trial Balance',
  pnl: 'Profit & Loss',
  balanceSheet: 'Balance Sheet',
  dayBook: 'Day Book',
  outstanding: 'Outstanding',
  forex: 'Forex',
  ledger: 'Ledger Drilldown',
}

const REPORT_PDF_TITLES = {
  summary: 'Summary Report',
  trial: 'Trial Balance Report',
  pnl: 'Profit and Loss Report',
  balanceSheet: 'Balance Sheet Report',
  dayBook: 'Day Book Report',
  outstanding: 'Outstanding Report',
  forex: 'Forex Gain/Loss Report',
  ledger: 'Ledger Report',
}

export const REPORT_PDF_MARGIN = 24
export const REPORT_PDF_TITLE_SIZE = 12
export const REPORT_PDF_META_SIZE = 7.5
export const REPORT_PDF_LINE_HEIGHT = 9
export const REPORT_PDF_TABLE_FONT = 7
export const REPORT_PDF_TABLE_PADDING = 2
export const REPORT_PDF_HEADER_GAP = 4

export function buildReportPdfHeaderLines({
  periodText = '',
  summaryLines = [],
  generatedAt = new Date(),
  compact = false,
} = {}) {
  const lines = [
    `Period: ${periodText}`,
    `Generated: ${generatedAt.toLocaleString()}`,
  ]
  if (!compact) {
    lines.push(...summaryLines)
  }
  return lines
}

export function renderReportPdfHeader(doc, { title, periodText, summaryLines, compact = true } = {}) {
  const margin = REPORT_PDF_MARGIN
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(0, 104, 74)
  doc.rect(margin, 16, pageWidth - margin * 2, 6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(REPORT_PDF_TITLE_SIZE)
  doc.setTextColor(17, 24, 39)
  doc.text(String(title), margin + 4, 32)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(REPORT_PDF_META_SIZE)
  doc.setTextColor(55, 65, 81)
  let metaY = 44
  buildReportPdfHeaderLines({ periodText, summaryLines, compact }).forEach((line) => {
    doc.text(String(line), margin + 4, metaY)
    metaY += REPORT_PDF_LINE_HEIGHT
  })
  return metaY + REPORT_PDF_HEADER_GAP
}

export function buildReportPdfColumnStyles(reportView, tableWidth) {
  const w = tableWidth
  if (reportView === 'trial' || reportView === 'summary') {
    const fixed = 44 + 48 + 64 + 64 + 64
    return {
      0: { cellWidth: 44 },
      1: { cellWidth: Math.max(w - fixed, 100) },
      2: { cellWidth: 48 },
      3: { cellWidth: 64, halign: 'right' },
      4: { cellWidth: 64, halign: 'right' },
      5: { cellWidth: 64, halign: 'right' },
    }
  }
  if (reportView === 'pnl' || reportView === 'balanceSheet') {
    const fixed = 44 + 44 + 68
    return {
      0: { cellWidth: 44 },
      1: { cellWidth: 44 },
      2: { cellWidth: Math.max(w - fixed, 100) },
      3: { cellWidth: 68, halign: 'right' },
    }
  }
  if (reportView === 'dayBook') {
    return {
      0: { cellWidth: 88 },
      1: { cellWidth: 52 },
      2: { cellWidth: Math.max(w - 88 - 52 - 56 - 56 - 72, 100) },
      3: { cellWidth: 56 },
      4: { cellWidth: 56 },
      5: { cellWidth: 72, halign: 'right' },
    }
  }
  if (reportView === 'outstanding') {
    const fixed = 56 + 52 + 56 + 88
    return {
      0: { cellWidth: 56 },
      1: { cellWidth: Math.max(w - fixed, 120) },
      2: { cellWidth: 52 },
      3: { cellWidth: 72, halign: 'right' },
      4: { cellWidth: 88 },
    }
  }
  if (reportView === 'forex') {
    return {
      0: { cellWidth: Math.max(w - 156, 80) },
      1: { cellWidth: 72, halign: 'right' },
      2: { cellWidth: 84, halign: 'right' },
    }
  }
  if (reportView === 'ledger') {
    return {
      0: { cellWidth: 48 },
      1: { cellWidth: 88 },
      2: { cellWidth: 48 },
      3: { cellWidth: Math.max(w - 48 - 88 - 48 - 56 - 56 - 72, 80) },
      4: { cellWidth: 56, halign: 'right' },
      5: { cellWidth: 56, halign: 'right' },
      6: { cellWidth: 72, halign: 'right' },
    }
  }
  return {}
}

export function isReportDataReady(reportView = 'summary', reports = {}, ledgerReportRows = []) {
  switch (reportView) {
    case 'summary':
    case 'trial':
      return Boolean(reports.trialBalance)
    case 'pnl':
      return Boolean(reports.profitLoss)
    case 'balanceSheet':
      return Boolean(reports.balanceSheet)
    case 'dayBook':
      return Boolean(reports.dayBook)
    case 'outstanding':
      return Boolean(reports.customerOutstanding) && Boolean(reports.vendorOutstanding)
    case 'forex':
      return Boolean(reports.forex)
    case 'ledger':
      return Array.isArray(ledgerReportRows) && ledgerReportRows.length > 0
    default:
      return false
  }
}

export function getReportNotReadyMessage(reportView = 'summary', action = 'exporting') {
  const label = REPORT_VIEW_LABELS[reportView] || 'report'
  const verb = action === 'printing' ? 'printing' : action === 'downloading' ? 'downloading PDF' : 'exporting'
  return `Load ${label} first before ${verb}`
}

export function formatReportPeriodText(reports = {}, reportView = 'summary') {
  const period =
    (reportView === 'pnl' && reports.profitLoss?.period)
    || (reportView === 'balanceSheet' && reports.balanceSheet?.period)
    || (reportView === 'dayBook' && reports.dayBook?.period)
    || (reportView === 'forex' && reports.forex?.period)
    || reports.trialBalance?.period

  if (period?.startDate) {
    return `${period.startDate} to ${period.endDate || period.startDate}`
  }
  return `As on ${new Date().toLocaleDateString()}`
}

export function buildReportPdfMeta({
  reportView = 'summary',
  reports = {},
  selectedReportAccountCode = '',
} = {}) {
  const titleBase = REPORT_PDF_TITLES[reportView] || 'ERP Report'
  const title = reportView === 'ledger' && selectedReportAccountCode
    ? `${REPORT_PDF_TITLES.ledger} - ${selectedReportAccountCode}`
    : titleBase
  const periodText = formatReportPeriodText(reports, reportView)
  const summaryLines = []

  if (reportView === 'trial' || reportView === 'summary') {
    const tb = reports.trialBalance || {}
    summaryLines.push(
      `Total Debit: ${Number(tb.totalDebit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Total Credit: ${Number(tb.totalCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Difference: ${Number(tb.difference || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Status: ${tb.balanced ? 'Balanced' : 'Out of balance'}`,
    )
  } else if (reportView === 'pnl') {
    const pnl = reports.profitLoss || {}
    summaryLines.push(
      `Total Income: ${Number(pnl.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Total Expense: ${Number(pnl.totalExpense || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Net Profit: ${Number(pnl.netProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    )
  } else if (reportView === 'balanceSheet') {
    const bs = reports.balanceSheet || {}
    summaryLines.push(
      `Total Assets: ${Number(bs.totalAssets || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Liabilities + Equity: ${Number(bs.liabilitiesPlusEquity || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `Working Capital: ${Number(bs.workingCapital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    )
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const fileBase = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}`

  return { title, periodText, summaryLines, fileBase }
}

export function buildReportPdfTable({
  reportView = 'summary',
  reports = {},
  ledgerReportRows = [],
  formatMoney = (value) => String(value ?? ''),
  formatReportDirectionalBalance = (row, direction) => String(row?.balance ?? direction ?? ''),
  forPdf = false,
} = {}) {
  if (reportView === 'trial' || reportView === 'summary') {
    return {
      head: [['Code', 'Account', 'Type', 'Debit', 'Credit', 'Net']],
      body: trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || []).map((row) => [
        row.accountCode,
        row.accountName,
        row.accountType,
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.net),
      ]),
    }
  }

  if (reportView === 'pnl') {
    const incomeRows = (reports.profitLoss?.incomeBreakdown || []).map((row) => ['Income', row.accountCode, row.accountName, formatMoney(row.amount)])
    const expenseRows = (reports.profitLoss?.expenseBreakdown || []).map((row) => ['Expense', row.accountCode, row.accountName, formatMoney(row.amount)])
    const monthlyRows = forPdf
      ? []
      : (reports.profitLoss?.monthlyComparison || []).map((row) => ['Monthly', row.label, 'Net Profit', formatMoney(row.netProfit)])
    return {
      head: [['Section', 'Code', 'Account', 'Amount']],
      body: [
        ...incomeRows,
        ['Subtotal', '', 'Total Income', formatMoney(reports.profitLoss?.totalIncome)],
        ...expenseRows,
        ['Subtotal', '', 'Total Expense', formatMoney(reports.profitLoss?.totalExpense)],
        ['Total', 'NET', 'Net Profit', formatMoney(reports.profitLoss?.netProfit)],
        ...monthlyRows,
      ],
    }
  }

  if (reportView === 'balanceSheet') {
    return {
      head: [['Section', 'Code', 'Account', 'Balance']],
      body: [
        ...(reports.balanceSheet?.assets || []).map((row) => ['Asset', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Dr')]),
        ...(reports.balanceSheet?.liabilities || []).map((row) => ['Liability', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Cr')]),
        ...(reports.balanceSheet?.equity || []).map((row) => ['Equity', row.accountCode, `${row.accountName}${row.isReclassified ? ' (reclassified)' : ''}`, formatReportDirectionalBalance(row, 'Cr')]),
      ],
    }
  }

  if (reportView === 'dayBook') {
    return {
      head: [['Date', 'Type', 'Description', 'Debit A/C', 'Credit A/C', 'Amount']],
      body: (reports.dayBook?.entries || []).map((row) => [
        new Date(row.date).toLocaleString(),
        row.referenceType,
        row.description || '',
        row.debitAccountId?.accountCode || '',
        row.creditAccountId?.accountCode || '',
        formatMoney(row.amount),
      ]),
    }
  }

  if (reportView === 'outstanding') {
    return {
      head: [['Party', 'Name', 'Ledger', 'Outstanding', 'Age/Type']],
      body: [
        ...(reports.customerOutstanding?.rows || []).map((row) => ['Customer', row.customerName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), `90+: ${formatMoney(row.aging?.bucket90Plus || 0)}`]),
        ...(reports.vendorOutstanding?.rows || []).map((row) => ['Vendor', row.vendorName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), row.outstandingType || '']),
      ],
    }
  }

  if (reportView === 'forex') {
    return {
      head: [['Currency', 'Entries', 'Impact']],
      body: Object.entries(reports.forex?.byCurrency || {}).map(([currency, row]) => [currency, String(row.count || 0), formatMoney(row.impact)]),
    }
  }

  if (reportView === 'ledger') {
    return {
      head: [['Voucher', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Running']],
      body: (ledgerReportRows || []).map((row) => [
        String(row.entryId || '').slice(-6).toUpperCase(),
        new Date(row.date).toLocaleString(),
        row.referenceType,
        row.description || '',
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.runningBalance),
      ]),
    }
  }

  return { head: [], body: [] }
}

export function buildReportExportPayload({
  reportView = 'summary',
  reports = {},
  branding = {},
  defaultBranding = {},
  ledgerReportRows = [],
} = {}) {
  if (!isReportDataReady(reportView, reports, ledgerReportRows)) return null
  const stamp = new Date().toISOString().slice(0, 10)
  const brandingRows = [
    [branding.entityName || defaultBranding.entityName, branding.branchName || ''],
    [branding.companyName || defaultBranding.companyName],
    [branding.legalName || ''],
    [branding.reportSubtitle || defaultBranding.reportSubtitle],
    [branding.reportFooter || defaultBranding.reportFooter],
    [],
  ]
  if (reportView === 'trial' || reportView === 'summary') {
    const trialRows = trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || [])
    const rows = [...brandingRows, ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Net']]
    trialRows.forEach((row) => {
      rows.push([row.accountCode, row.accountName, row.accountType, row.debit, row.credit, row.net])
    })
    const isSummary = reportView === 'summary'
    return {
      rows,
      fileBase: isSummary ? `summary-${stamp}` : `trial-balance-${stamp}`,
      sheetName: isSummary ? 'Summary' : 'Trial Balance',
      successLabel: isSummary ? 'Summary' : 'Trial balance',
    }
  }
  if (reportView === 'pnl') {
    const rows = [...brandingRows, ['Section', 'Account Code', 'Account Name', 'Amount']]
    ;(reports.profitLoss?.incomeBreakdown || []).forEach((row) => rows.push(['Income', row.accountCode, row.accountName, row.amount]))
    ;(reports.profitLoss?.expenseBreakdown || []).forEach((row) => rows.push(['Expense', row.accountCode, row.accountName, row.amount]))
    ;(reports.profitLoss?.monthlyComparison || []).forEach((row) => rows.push(['Monthly', row.label, 'Net Profit', row.netProfit]))
    return { rows, fileBase: `profit-loss-${stamp}`, sheetName: 'Profit Loss', successLabel: 'Profit & loss' }
  }
  if (reportView === 'balanceSheet') {
    const rows = [...brandingRows, ['Section', 'Account Code', 'Account Name', 'Balance', 'Direction', 'Reclassified']]
    ;(reports.balanceSheet?.assets || []).forEach((row) => rows.push(['Asset', row.accountCode, row.accountName, row.balance, row.direction || 'Dr', row.isReclassified ? 'Yes' : 'No']))
    ;(reports.balanceSheet?.liabilities || []).forEach((row) => rows.push(['Liability', row.accountCode, row.accountName, row.balance, row.direction || 'Cr', row.isReclassified ? 'Yes' : 'No']))
    ;(reports.balanceSheet?.equity || []).forEach((row) => rows.push(['Equity', row.accountCode, row.accountName, row.balance, row.direction || 'Cr', row.isReclassified ? 'Yes' : 'No']))
    ;(reports.balanceSheet?.monthlyComparison || []).forEach((row) => rows.push(['Monthly', row.label, 'Working Capital', row.workingCapital]))
    return { rows, fileBase: `balance-sheet-${stamp}`, sheetName: 'Balance Sheet', successLabel: 'Balance sheet' }
  }
  if (reportView === 'dayBook') {
    const rows = [...brandingRows, ['Date', 'Type', 'Description', 'Debit Account', 'Credit Account', 'Amount', 'Currency']]
    ;(reports.dayBook?.entries || []).forEach((row) => {
      rows.push([
        new Date(row.date).toLocaleString(),
        row.referenceType,
        row.description || '',
        row.debitAccountId?.accountCode || '',
        row.creditAccountId?.accountCode || '',
        row.amount,
        row.currency || 'USD',
      ])
    })
    return { rows, fileBase: `day-book-${stamp}`, sheetName: 'Day Book', successLabel: 'Day book' }
  }
  if (reportView === 'outstanding') {
    const rows = [...brandingRows, ['Category', 'Name', 'Ledger Code', 'Outstanding', '0-30', '31-60', '61-90', '90+', 'Limit Exceeded']]
    ;(reports.customerOutstanding?.rows || []).forEach((row) => {
      rows.push(['Customer', row.customerName, row.ledgerAccount?.accountCode || '', row.outstanding, row.aging?.bucket0to30 || 0, row.aging?.bucket31to60 || 0, row.aging?.bucket61to90 || 0, row.aging?.bucket90Plus || 0, row.limitExceeded ? 'Yes' : 'No'])
    })
    ;(reports.vendorOutstanding?.rows || []).forEach((row) => {
      rows.push(['Vendor', row.vendorName, row.ledgerAccount?.accountCode || '', row.outstanding, '', '', '', '', row.outstandingType || ''])
    })
    return { rows, fileBase: `outstanding-${stamp}`, sheetName: 'Outstanding', successLabel: 'Outstanding' }
  }
  if (reportView === 'ledger') {
    const rows = [...brandingRows, ['Voucher', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Running Balance']]
    ledgerReportRows.forEach((row) => {
      rows.push([String(row.entryId || '').slice(-6).toUpperCase(), new Date(row.date).toLocaleString(), row.referenceType, row.description || '', row.debit || 0, row.credit || 0, row.runningBalance || 0])
    })
    return { rows, fileBase: `account-ledger-${stamp}`, sheetName: 'Ledger', successLabel: 'Ledger drilldown' }
  }
  if (reportView === 'forex') {
    const rows = [...brandingRows, ['Currency', 'Entries', 'Impact']]
    Object.entries(reports.forex?.byCurrency || {}).forEach(([currency, row]) => rows.push([currency, row.count || 0, row.impact || 0]))
    return { rows, fileBase: `forex-impact-${stamp}`, sheetName: 'Forex', successLabel: 'Forex report' }
  }
  return null
}
