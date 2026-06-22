import { apiRequest } from '@/src/api/client'

export type TransactionAccountRef = {
  _id?: string
  accountCode?: string
  accountName?: string
}

export type TransactionRow = {
  _id: string
  type?: string
  status?: string
  date?: string
  createdAt?: string
  amount?: number
  currency?: string
  description?: string
  customerId?: { name?: string }
  vendorId?: { name?: string }
  inventoryItemId?: { sku?: string; name?: string }
  debitAccountId?: TransactionAccountRef
  creditAccountId?: TransactionAccountRef
  voucherMeta?: {
    partyName?: string
    partyCode?: string
    refNo?: string
    vocNo?: string
    lineItems?: Array<{ narration?: string; exp?: string; acCode?: string }>
  }
  attachments?: unknown[]
}

export type TransactionSummary = {
  totalCount?: number
  totalAmount?: number
  draft?: number
  submitted?: number
  approved?: number
  posted?: number
  returned?: number
  rejected?: number
}

export type TransactionsQuery = {
  limit?: number
  cursor?: string | null
  search?: string
  status?: string
  type?: string
  startDate?: string
  endDate?: string
}

export type FetchAllTransactionsResult = TransactionsResponse & {
  transactions: TransactionRow[]
  capped?: boolean
}

const MAX_FETCH_ALL_ROWS = 500

export type TransactionsResponse = {
  success?: boolean
  transactions?: TransactionRow[]
  summary?: TransactionSummary
  hasMore?: boolean
  nextCursor?: string | null
  total?: number
  message?: string
}

function cleanParams(params: TransactionsQuery) {
  const out: Record<string, string | number> = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    out[k] = v as string | number
  })
  return out
}

export async function fetchTransactions(token: string, params: TransactionsQuery = {}) {
  return apiRequest<TransactionsResponse>('/api/erp-accounting/transactions', {
    token,
    params: cleanParams({ limit: 50, ...params }),
  })
}

/** Fetches all pages until hasMore is false or MAX_FETCH_ALL_ROWS is reached. */
export async function fetchAllTransactions(
  token: string,
  params: Omit<TransactionsQuery, 'cursor'> = {},
): Promise<FetchAllTransactionsResult> {
  const all: TransactionRow[] = []
  let cursor: string | null = null
  let lastResponse: TransactionsResponse = {}
  let capped = false

  while (all.length < MAX_FETCH_ALL_ROWS) {
    const data = await fetchTransactions(token, { ...params, cursor })
    lastResponse = data
    const batch = data.transactions || []
    all.push(...batch)
    if (!data.hasMore || !data.nextCursor) break
    cursor = data.nextCursor
    if (all.length >= MAX_FETCH_ALL_ROWS) {
      capped = true
      break
    }
  }

  return {
    ...lastResponse,
    transactions: all,
    hasMore: capped ? true : false,
    capped,
  }
}
