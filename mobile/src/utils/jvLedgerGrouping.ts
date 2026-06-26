import type { LedgerEntryRow } from '@/src/api/ledger'

const SYSTEM_FX_ADJUSTMENT_DESC_RE = /Exchange (gain|loss) adjustment for transaction /i

export function normalizeJvCurrencyCode(value = ''): string {
  const code = String(value || '').trim().toUpperCase()
  if (['SOM', 'SOMS', 'SUM'].includes(code)) return 'UZS'
  return code
}

export function jvDescriptionHead(description = ''): string {
  const raw = String(description || '')
  return (raw.includes(' — ') ? raw.split(' — ')[0] : raw.split(' - ')[0]).trim()
}

export function extractLedgerJvDocNoFromDescription(description = ''): string {
  const head = jvDescriptionHead(description)
  return /^(jv|bnkjv)[/-]/i.test(head) ? head : ''
}

export function extractLedgerJvDetailFromDescription(description = ''): string {
  const raw = String(description || '')
  if (raw.includes(' — ')) {
    const parts = raw.split(' — ')
    if (parts.length <= 1) return ''
    return parts.slice(1).join(' — ').trim()
  }
  const parts = raw.split(' - ')
  if (parts.length <= 1) return ''
  return parts.slice(1).join(' - ').trim()
}

function isValidMongoObjectId(value = ''): boolean {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim())
}

function isSystemFxAdjustmentLedgerEntry(entry: LedgerEntryRow): boolean {
  return SYSTEM_FX_ADJUSTMENT_DESC_RE.test(String(entry?.description || ''))
}

export function isManualJvLedgerEntry(entry: LedgerEntryRow): boolean {
  const refType = String(entry?.referenceType || '').toLowerCase()
  if (refType !== 'journal' && refType !== 'bank_jv') return false
  if (refType === 'journal' && isSystemFxAdjustmentLedgerEntry(entry)) return false
  return true
}

export function jvLedgerGroupKey(entry: LedgerEntryRow): string {
  const refId = String(entry?.referenceId || '').trim()
  if (isValidMongoObjectId(refId)) return `ref:${refId}`
  const docNo = extractLedgerJvDocNoFromDescription(entry?.description)
  if (docNo) {
    const dateKey = entry?.date ? new Date(entry.date).toISOString().slice(0, 10) : ''
    return `doc:${docNo}:${dateKey}`
  }
  return `id:${entry?._id}`
}

function summarizeJvLedgerAccountCodes(entries: LedgerEntryRow[], side: 'debit' | 'credit'): string {
  const codes = new Set<string>()
  for (const entry of entries || []) {
    const account = side === 'debit' ? entry?.debitAccountId : entry?.creditAccountId
    const code = String(account?.accountCode || '').trim()
    if (code) codes.add(code)
  }
  return [...codes].sort((a, b) => a.localeCompare(b)).join(', ') || '—'
}

function sumJvLedgerBaseAmount(entries: LedgerEntryRow[] = []): number {
  return entries.reduce(
    (sum, entry) => sum + Number(entry?.amount || 0) * Number(entry?.exchangeRate ?? 1),
    0,
  )
}

export type GroupedJvVoucher = {
  key: string
  entries: LedgerEntryRow[]
  representative: LedgerEntryRow
  entryIds: string[]
  lineCount: number
  voucherNo: string
  date?: string
  referenceType?: string
  narration: string
  debitAccounts: string
  creditAccounts: string
  totalBaseAmount: number
  documentCurrencyCode: string
  documentFaceAmount: number | null
  attachmentUrl: string
  autoTxNo: string
  chequeNo: string
}

export function groupJvLedgerEntries(
  entries: LedgerEntryRow[] = [],
  opts: { baseCurrencyCode?: string } = {},
): GroupedJvVoucher[] {
  const baseNorm = normalizeJvCurrencyCode(opts.baseCurrencyCode || 'USD') || 'USD'
  const buckets = new Map<string, LedgerEntryRow[]>()

  for (const entry of entries || []) {
    if (!isManualJvLedgerEntry(entry)) continue
    const key = jvLedgerGroupKey(entry)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(entry)
  }

  return [...buckets.entries()].map(([key, groupEntries]) => {
    const sorted = [...groupEntries].sort((a, b) => {
      const aTs = new Date(a?.createdAt || a?.date || 0).getTime()
      const bTs = new Date(b?.createdAt || b?.date || 0).getTime()
      return aTs - bTs
    })
    const representative = sorted[0]
    const refType = String(representative?.referenceType || '').toLowerCase()
    const voucherNo =
      extractLedgerJvDocNoFromDescription(representative?.description) ||
      (refType === 'bank_jv' && representative?.autoTxNo ? representative.autoTxNo : '—')
    const narration =
      String(representative?.notes || '').trim() ||
      extractLedgerJvDetailFromDescription(representative?.description) ||
      '—'

    const repCur = normalizeJvCurrencyCode(representative?.currency || '')
    const allSameCur =
      sorted.length > 0 &&
      sorted.every((e) => normalizeJvCurrencyCode(e?.currency || repCur) === repCur)
    const documentFaceAmount =
      allSameCur && repCur && repCur !== baseNorm
        ? Number(sorted.reduce((sum, e) => sum + Number(e?.amount || 0), 0).toFixed(2))
        : null

    return {
      key,
      entries: sorted,
      representative,
      entryIds: sorted.map((entry) => entry._id).filter(Boolean),
      lineCount: sorted.length,
      voucherNo,
      date: representative?.date,
      referenceType: representative?.referenceType,
      narration,
      debitAccounts: summarizeJvLedgerAccountCodes(sorted, 'debit'),
      creditAccounts: summarizeJvLedgerAccountCodes(sorted, 'credit'),
      totalBaseAmount: sumJvLedgerBaseAmount(sorted),
      documentCurrencyCode: documentFaceAmount != null ? repCur : '',
      documentFaceAmount,
      attachmentUrl: sorted.find((entry) => entry?.attachmentUrl)?.attachmentUrl || '',
      autoTxNo: sorted.find((entry) => entry?.autoTxNo)?.autoTxNo || '',
      chequeNo: sorted.find((entry) => entry?.chequeNo)?.chequeNo || '',
    }
  })
}
