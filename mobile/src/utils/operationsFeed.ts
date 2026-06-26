import type { TransactionRow } from '@/src/api/transactions'
import type { GroupedJvVoucher } from '@/src/utils/jvLedgerGrouping'
import {
  apiTypeToLabel,
  isIncomeTransactionType,
  isOutcomeTransactionType,
  jvCategoryKey,
  transactionCategoryKey,
  type OperationTypeOption,
} from '@/src/constants/transactionTypes'
import {
  getTransactionDescription,
  getTransactionPartyLabel,
} from '@/src/utils/transactionFilters'

export type OperationEntry =
  | {
      kind: 'transaction'
      id: string
      date: string
      categoryKey: string
      amount: number
      currency: string
      title: string
      subtitle: string
      accountRef: string
      isOutcome: boolean
      isIncome: boolean
      row: TransactionRow
    }
  | {
      kind: 'jv'
      id: string
      date: string
      categoryKey: string
      jvType: 'journal' | 'bank_jv'
      amount: number
      currency: string
      title: string
      subtitle: string
      accountRef: string
      isOutcome: boolean
      isIncome: boolean
      voucher: GroupedJvVoucher
    }

export type OperationsFilterState = {
  search: string
  status: string
  operationKey: string
  startDate: string
  endDate: string
  accountCode: string
}

export type CategorySummary = {
  categoryKey: string
  label: string
  count: number
  totalAmount: number
  isOutcome: boolean
  isIncome: boolean
}

export type OutcomeIncomeTotals = {
  outcome: number
  income: number
}

export type DateSection = {
  title: string
  dateKey: string
  data: OperationEntry[]
}

function maskAccountCode(code: string): string {
  const raw = String(code || '').trim()
  if (!raw || raw.length <= 6) return raw || '—'
  return `${raw.slice(0, 6)}${'*'.repeat(Math.min(8, raw.length - 6))}${raw.slice(-2)}`
}

function resolveAccountRef(debitCode?: string, creditCode?: string): string {
  const dr = String(debitCode || '').trim()
  const cr = String(creditCode || '').trim()
  if (dr && cr && dr !== cr) return maskAccountCode(dr)
  return maskAccountCode(dr || cr)
}

function parseDateKey(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function formatSectionDate(dateKey: string): string {
  if (!dateKey) return '—'
  const d = new Date(`${dateKey}T12:00:00`)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatPeriodLabel(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return 'All dates'
  const fmt = (s: string) => {
    const d = new Date(`${s}T12:00:00`)
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
  }
  if (startDate && endDate) return `${fmt(startDate)} – ${fmt(endDate)}`
  if (startDate) return `From ${fmt(startDate)}`
  return `Until ${fmt(endDate)}`
}

export function categoryLabel(categoryKey: string): string {
  if (categoryKey === 'jv_journal') return 'Normal JV'
  if (categoryKey === 'jv_bank') return 'Bank JV'
  if (categoryKey.startsWith('txn_')) {
    return apiTypeToLabel(categoryKey.replace(/^txn_/, ''))
  }
  return categoryKey
}

function transactionToOperation(tx: TransactionRow, baseCurrency: string): OperationEntry {
  const apiType = String(tx.type || '').toLowerCase()
  const amount = Number(tx.amount || 0)
  const currency = String(tx.currency || baseCurrency || 'USD')
  const debitCode = tx.debitAccountId?.accountCode
  const creditCode = tx.creditAccountId?.accountCode

  return {
    kind: 'transaction',
    id: tx._id,
    date: tx.date || tx.createdAt || '',
    categoryKey: transactionCategoryKey(apiType),
    amount,
    currency,
    title: getTransactionPartyLabel(tx),
    subtitle: apiTypeToLabel(apiType),
    accountRef: resolveAccountRef(debitCode, creditCode),
    isOutcome: isOutcomeTransactionType(apiType),
    isIncome: isIncomeTransactionType(apiType),
    row: tx,
  }
}

function jvToOperation(voucher: GroupedJvVoucher, baseCurrency: string): OperationEntry {
  const jvType = String(voucher.referenceType || 'journal').toLowerCase() as 'journal' | 'bank_jv'
  const amount =
    voucher.documentFaceAmount != null ? voucher.documentFaceAmount : voucher.totalBaseAmount
  const currency =
    voucher.documentCurrencyCode || String(voucher.representative?.currency || baseCurrency || 'USD')

  return {
    kind: 'jv',
    id: voucher.key,
    date: voucher.date || '',
    categoryKey: jvCategoryKey(jvType),
    jvType: jvType === 'bank_jv' ? 'bank_jv' : 'journal',
    amount,
    currency,
    title: voucher.voucherNo !== '—' ? voucher.voucherNo : voucher.narration,
    subtitle: jvType === 'bank_jv' ? 'Bank JV' : 'Normal JV',
    accountRef: resolveAccountRef(voucher.debitAccounts.split(',')[0], voucher.creditAccounts.split(',')[0]),
    isOutcome: true,
    isIncome: false,
    voucher,
  }
}

function matchesSearch(entry: OperationEntry, search: string): boolean {
  const q = search.trim().toLowerCase()
  if (!q) return true
  if (entry.kind === 'transaction') {
    const tx = entry.row
    const hay = [
      entry.title,
      entry.subtitle,
      getTransactionDescription(tx),
      tx.voucherMeta?.vocNo,
      tx.voucherMeta?.refNo,
      tx.currency,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  }
  const v = entry.voucher
  const hay = [entry.title, entry.subtitle, v.narration, v.debitAccounts, v.creditAccounts, v.chequeNo, v.autoTxNo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function matchesAccount(entry: OperationEntry, accountCode: string): boolean {
  const code = accountCode.trim().toLowerCase()
  if (!code) return true
  if (entry.kind === 'transaction') {
    const dr = String(entry.row.debitAccountId?.accountCode || '').toLowerCase()
    const cr = String(entry.row.creditAccountId?.accountCode || '').toLowerCase()
    return dr === code || cr === code
  }
  const dr = entry.voucher.debitAccounts.toLowerCase()
  const cr = entry.voucher.creditAccounts.toLowerCase()
  return dr.includes(code) || cr.includes(code)
}

function matchesOperationKey(entry: OperationEntry, operationKey: string): boolean {
  if (!operationKey) return true
  return entry.categoryKey === operationKey
}

function matchesStatus(entry: OperationEntry, status: string): boolean {
  if (!status) return true
  if (entry.kind !== 'transaction') return true
  return String(entry.row.status || '').toLowerCase() === status.toLowerCase()
}

export function buildOperationEntries(
  transactions: TransactionRow[],
  jvVouchers: GroupedJvVoucher[],
  baseCurrency: string,
): OperationEntry[] {
  const txnOps = transactions.map((tx) => transactionToOperation(tx, baseCurrency))
  const jvOps = jvVouchers.map((v) => jvToOperation(v, baseCurrency))
  return [...txnOps, ...jvOps].sort((a, b) => {
    const aTs = new Date(a.date || 0).getTime()
    const bTs = new Date(b.date || 0).getTime()
    return bTs - aTs
  })
}

export function filterOperationEntries(
  entries: OperationEntry[],
  filters: OperationsFilterState,
): OperationEntry[] {
  return entries.filter(
    (e) =>
      matchesSearch(e, filters.search) &&
      matchesAccount(e, filters.accountCode) &&
      matchesOperationKey(e, filters.operationKey) &&
      matchesStatus(e, filters.status),
  )
}

export function computeOutcomeIncome(entries: OperationEntry[]): OutcomeIncomeTotals {
  let outcome = 0
  let income = 0
  for (const e of entries) {
    const amt = Math.abs(Number(e.amount || 0))
    if (e.isOutcome) outcome += amt
    if (e.isIncome) income += amt
  }
  return { outcome, income }
}

export function computeCategorySummaries(entries: OperationEntry[]): CategorySummary[] {
  const map = new Map<string, CategorySummary>()
  for (const e of entries) {
    const existing = map.get(e.categoryKey)
    const amt = Math.abs(Number(e.amount || 0))
    if (existing) {
      existing.count += 1
      existing.totalAmount += amt
    } else {
      map.set(e.categoryKey, {
        categoryKey: e.categoryKey,
        label: categoryLabel(e.categoryKey),
        count: 1,
        totalAmount: amt,
        isOutcome: e.isOutcome,
        isIncome: e.isIncome,
      })
    }
  }
  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount)
}

export function groupEntriesByDate(entries: OperationEntry[]): DateSection[] {
  const map = new Map<string, OperationEntry[]>()
  for (const e of entries) {
    const key = parseDateKey(e.date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, data]) => ({
      dateKey,
      title: formatSectionDate(dateKey),
      data,
    }))
}

export function filterOperationOptions(
  options: OperationTypeOption[],
  canTransactions: boolean,
  canLedger: boolean,
): OperationTypeOption[] {
  return options.filter((opt) => {
    if (!opt.key) return true
    if (opt.source === 'jv') return canLedger
    return canTransactions
  })
}

export function currentMonthDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

export function lastMonthDateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

export function formatMoneyAmount(amount: number, currency: string, signed = false): string {
  const abs = Math.abs(Number(amount || 0))
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (!signed) return `${formatted} ${currency}`
  const sign = amount < 0 ? '- ' : amount > 0 ? '+ ' : ''
  return `${sign}${formatted} ${currency}`
}
