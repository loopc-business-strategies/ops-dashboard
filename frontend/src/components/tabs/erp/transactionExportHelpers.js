/**
 * Pure builders for ERP transaction register exports (CSV/XLSX row grids).
 */

export function buildTransactionExportPayload({
  transactions = [],
  selectedTransactionIds = [],
  transactionTypeLabels = {},
} = {}) {
  const scope = selectedTransactionIds.length
    ? transactions.filter((tx) => selectedTransactionIds.includes(tx._id))
    : transactions
  if (!scope.length) return null
  const stamp = new Date().toISOString().slice(0, 10)
  const rows = [
    ['Ops Dashboard ERP Transactions'],
    ['Generated', new Date().toLocaleString()],
    ['Scope', selectedTransactionIds.length ? 'Selected transactions' : 'Current visible transactions'],
    [],
    ['Date', 'Type', 'Party', 'Amount', 'Currency', 'Status', 'Description', 'Debit Account', 'Credit Account', 'Created By', 'Approved By', 'Posted By', 'Comments', 'Audit Events'],
  ]
  scope.forEach((tx) => {
    rows.push([
      tx.date ? new Date(tx.date).toLocaleString() : '',
      transactionTypeLabels[tx.type] || tx.type,
      tx.customerId?.name || tx.vendorId?.name || tx.inventoryItemId?.sku || '',
      Number(tx.amount || 0),
      tx.currency || 'USD',
      tx.status || '',
      tx.description || '',
      tx.debitAccountId ? `${tx.debitAccountId.accountCode} - ${tx.debitAccountId.accountName}` : '',
      tx.creditAccountId ? `${tx.creditAccountId.accountCode} - ${tx.creditAccountId.accountName}` : '',
      tx.createdBy?.name || '',
      tx.approvedBy?.name || '',
      tx.postedBy?.name || '',
      Number(tx.comments?.length || 0),
      Number(tx.auditTrail?.length || 0),
    ])
  })
  return { rows, fileBase: `transactions-${stamp}`, sheetName: 'Transactions', scope }
}

/** Rows for jsPDF autoTable body (transactions register PDF). */
export function buildTransactionsPdfTableBody(scope = [], transactionTypeLabels = {}) {
  return scope.map((tx) => [
    tx.date ? new Date(tx.date).toLocaleDateString() : '',
    transactionTypeLabels[tx.type] || tx.type,
    tx.customerId?.name || tx.vendorId?.name || tx.inventoryItemId?.sku || '',
    `${tx.currency || 'USD'} ${Number(tx.amount || 0).toLocaleString()}`,
    tx.status || '',
    tx.description || '',
    String(tx.comments?.length || 0),
    String(tx.auditTrail?.length || 0),
  ])
}
