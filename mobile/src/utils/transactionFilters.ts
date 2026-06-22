import type { TransactionRow } from '@/src/api/transactions'
import type { TransactionSort } from '@/src/constants/transactionTypes'

export function filterTransactionsByAccount(rows: TransactionRow[], accountCode: string): TransactionRow[] {
  const code = String(accountCode || '').trim().toLowerCase()
  if (!code) return rows
  return rows.filter((tx) => {
    const dr = String(tx.debitAccountId?.accountCode || '').toLowerCase()
    const cr = String(tx.creditAccountId?.accountCode || '').toLowerCase()
    return dr === code || cr === code
  })
}

export function sortTransactions(rows: TransactionRow[], sort: TransactionSort): TransactionRow[] {
  const copy = [...rows]
  copy.sort((a, b) => {
    const aDate = new Date(a.date || a.createdAt || 0).getTime()
    const bDate = new Date(b.date || b.createdAt || 0).getTime()
    const aAmt = Number(a.amount || 0)
    const bAmt = Number(b.amount || 0)
    if (sort === 'date_asc') return aDate - bDate
    if (sort === 'amount_desc') return bAmt - aAmt
    if (sort === 'amount_asc') return aAmt - bAmt
    return bDate - aDate
  })
  return copy
}

export function getTransactionPartyLabel(tx: TransactionRow): string {
  const partyName =
    tx.customerId?.name ||
    tx.vendorId?.name ||
    tx.voucherMeta?.partyName ||
    tx.voucherMeta?.lineItems?.find((line) => line?.acCode)?.acCode ||
    tx.inventoryItemId?.sku ||
    tx.inventoryItemId?.name ||
    ''
  const partyCode = tx.voucherMeta?.partyCode || ''
  if (partyName && partyCode && !String(partyName).includes(partyCode)) {
    return `${partyName} (${partyCode})`
  }
  return partyName || partyCode || '-'
}

export function getTransactionDescription(tx: TransactionRow): string {
  const fromLine =
    tx.voucherMeta?.lineItems?.find((line) => String(line?.narration || '').trim())?.narration ||
    tx.voucherMeta?.lineItems?.find((line) => String(line?.exp || '').trim())?.exp
  return (
    fromLine ||
    tx.description ||
    tx.voucherMeta?.refNo ||
    tx.voucherMeta?.vocNo ||
    '-'
  )
}
