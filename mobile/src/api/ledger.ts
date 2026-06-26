import { apiRequest } from '@/src/api/client'

export type LedgerAccountRef = {
  _id?: string
  accountCode?: string
  accountName?: string
  currency?: string
}

export type LedgerEntryRow = {
  _id: string
  date?: string
  createdAt?: string
  amount?: number
  currency?: string
  exchangeRate?: number
  description?: string
  notes?: string
  referenceType?: string
  referenceId?: string
  debitAccountId?: LedgerAccountRef
  creditAccountId?: LedgerAccountRef
  autoTxNo?: string
  txRefNo?: string
  chequeNo?: string
  bankRemarks?: string
  paymentType?: string
  attachmentUrl?: string
  attachmentName?: string
}

export type LedgerQuery = {
  limit?: number
  cursor?: string | null
  startDate?: string
  endDate?: string
  accountId?: string
  referenceType?: string
}

export type LedgerResponse = {
  success?: boolean
  entries?: LedgerEntryRow[]
  hasMore?: boolean
  nextCursor?: string | null
  message?: string
}

export type FetchAllJvResult = LedgerResponse & {
  entries: LedgerEntryRow[]
  capped?: boolean
}

const MAX_FETCH_ALL_ROWS = 500
const LEDGER_BASE = '/api/erp-accounting/ledger'

function cleanParams(params: LedgerQuery) {
  const out: Record<string, string | number> = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    out[k] = v as string | number
  })
  return out
}

export async function fetchLedgerEntries(token: string, params: LedgerQuery = {}) {
  return apiRequest<LedgerResponse>(LEDGER_BASE, {
    token,
    params: cleanParams({ limit: 100, ...params }),
  })
}

async function fetchAllByReferenceType(
  token: string,
  referenceType: 'journal' | 'bank_jv',
  params: Omit<LedgerQuery, 'cursor' | 'referenceType'> = {},
): Promise<{ entries: LedgerEntryRow[]; capped: boolean }> {
  const all: LedgerEntryRow[] = []
  let cursor: string | null = null
  let capped = false

  while (all.length < MAX_FETCH_ALL_ROWS) {
    const data = await fetchLedgerEntries(token, { ...params, referenceType, cursor })
    const batch = data.entries || []
    all.push(...batch)
    if (!data.hasMore || !data.nextCursor) break
    cursor = data.nextCursor
    if (all.length >= MAX_FETCH_ALL_ROWS) {
      capped = true
      break
    }
  }

  return { entries: all, capped }
}

/** Fetches manual Normal JV + Bank JV ledger lines (paginated, cap 500 per type). */
export async function fetchAllJvLedgerEntries(
  token: string,
  params: Omit<LedgerQuery, 'cursor' | 'referenceType'> = {},
): Promise<FetchAllJvResult> {
  const [journal, bankJv] = await Promise.all([
    fetchAllByReferenceType(token, 'journal', params),
    fetchAllByReferenceType(token, 'bank_jv', params),
  ])

  return {
    success: true,
    entries: [...journal.entries, ...bankJv.entries],
    hasMore: journal.capped || bankJv.capped,
    capped: journal.capped || bankJv.capped,
  }
}
