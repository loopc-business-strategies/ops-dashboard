/** Chip value → API `type` param (web uses `sale`, chip label is salesInvoice). */
export const TRANSACTION_TYPE_CHIPS: { chip: string; apiType: string; label: string }[] = [
  { chip: 'expense', apiType: 'expense', label: 'expense' },
  { chip: 'salesInvoice', apiType: 'sale', label: 'salesInvoice' },
  { chip: 'purchase', apiType: 'purchase', label: 'purchase' },
  { chip: 'receipt', apiType: 'receipt', label: 'receipt' },
  { chip: 'payment', apiType: 'payment', label: 'payment' },
  { chip: 'payroll', apiType: 'payroll', label: 'Payroll' },
  { chip: 'metal_receipt', apiType: 'metal_receipt', label: 'metal_receipt' },
  { chip: 'metal_payment', apiType: 'metal_payment', label: 'metal_payment' },
]

export const TRANSACTION_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
] as const

export function chipToApiType(chip: string): string | undefined {
  if (!chip) return undefined
  const row = TRANSACTION_TYPE_CHIPS.find((t) => t.chip === chip)
  return row?.apiType || chip
}

export function apiTypeToLabel(apiType: string): string {
  const row = TRANSACTION_TYPE_CHIPS.find((t) => t.apiType === apiType)
  return row?.label || apiType
}

export type OperationTypeOption = {
  key: string
  label: string
  source: 'transaction' | 'jv'
  apiType?: string
  jvReferenceType?: 'journal' | 'bank_jv'
}

export const OPERATION_TYPE_OPTIONS: OperationTypeOption[] = [
  { key: '', label: 'All transactions', source: 'transaction' },
  ...TRANSACTION_TYPE_CHIPS.map((t) => ({
    key: `txn_${t.apiType}`,
    label: t.label,
    source: 'transaction' as const,
    apiType: t.apiType,
  })),
  { key: 'jv_journal', label: 'Normal JV', source: 'jv', jvReferenceType: 'journal' },
  { key: 'jv_bank', label: 'Bank JV', source: 'jv', jvReferenceType: 'bank_jv' },
]

export function transactionCategoryKey(apiType: string): string {
  return `txn_${String(apiType || '').toLowerCase()}`
}

export function jvCategoryKey(refType: string): string {
  return String(refType || '').toLowerCase() === 'bank_jv' ? 'jv_bank' : 'jv_journal'
}

const OUTCOME_TXN_TYPES = new Set(['payment', 'expense', 'purchase', 'metal_payment'])
const INCOME_TXN_TYPES = new Set(['receipt', 'sale', 'metal_receipt', 'payroll'])

export function isOutcomeTransactionType(apiType: string): boolean {
  return OUTCOME_TXN_TYPES.has(String(apiType || '').toLowerCase())
}

export function isIncomeTransactionType(apiType: string): boolean {
  return INCOME_TXN_TYPES.has(String(apiType || '').toLowerCase())
}
