/**
 * Pure builders for ERP financial report exports (CSV/XLSX row grids).
 */

export function buildReportExportPayload({
  reportView = 'summary',
  reports = {},
  branding = {},
  defaultBranding = {},
  ledgerReportRows = [],
} = {}) {
  if (!reports.trialBalance) return null
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
    const rows = [...brandingRows, ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Net']]
    ;(reports.trialBalance?.trialBalance || []).forEach((row) => {
      rows.push([row.accountCode, row.accountName, row.accountType, row.debit, row.credit, row.net])
    })
    return { rows, fileBase: `trial-balance-${stamp}`, sheetName: 'Trial Balance', successLabel: 'Trial balance' }
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
