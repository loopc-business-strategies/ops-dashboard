import type { TransactionRow } from '@/src/api/transactions'

export function filterTransactionsByAccount(rows: TransactionRow[], accountCode: string): TransactionRow[] {
  const code = String(accountCode || '').trim().toLowerCase()
  if (!code) return rows
  return rows.filter((tx) => {
    const dr = String(tx.debitAccountId?.accountCode || '').toLowerCase()
    const cr = String(tx.creditAccountId?.accountCode || '').toLowerCase()
    return dr === code || cr === code
  })
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
