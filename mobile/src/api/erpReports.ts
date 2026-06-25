import { apiRequest } from './client'

const REPORTS_BASE = '/api/erp-accounting/reports'
const ACCOUNTS_BASE = '/api/erp-accounting/accounts'

function cleanParams(params: Record<string, string | number | boolean | undefined | null>) {
  const out: Record<string, string | number> = {}
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    if (typeof v === 'boolean') out[k] = v ? 'true' : 'false'
    else out[k] = v
  })
  return out
}

export async function getTrialBalanceReport(
  token: string,
  params: Record<string, string | number | boolean | undefined | null>,
) {
  return apiRequest(`${REPORTS_BASE}/trial-balance`, { token, params: cleanParams(params) })
}

export async function getProfitLossReport(
  token: string,
  params: Record<string, string | number | boolean | undefined | null>,
) {
  return apiRequest(`${REPORTS_BASE}/profit-loss`, { token, params: cleanParams(params) })
}

export async function getBalanceSheetReport(
  token: string,
  params: Record<string, string | number | boolean | undefined | null>,
) {
  return apiRequest(`${REPORTS_BASE}/balance-sheet`, { token, params: cleanParams(params) })
}

export async function getDayBookReport(
  token: string,
  params: Record<string, string | number | boolean | undefined | null>,
) {
  return apiRequest(`${REPORTS_BASE}/day-book`, { token, params: cleanParams(params) })
}

export async function getCustomerOutstandingReport(token: string) {
  return apiRequest(`${REPORTS_BASE}/customer-outstanding`, { token })
}

export async function getVendorOutstandingReport(token: string) {
  return apiRequest(`${REPORTS_BASE}/vendor-outstanding`, { token })
}

export async function getForexGainLossReport(
  token: string,
  params: Record<string, string | number | boolean | undefined | null>,
) {
  return apiRequest(`${REPORTS_BASE}/forex-gain-loss`, { token, params: cleanParams(params) })
}

export async function getLedgerReport(
  token: string,
  params: Record<string, string | number | boolean | undefined | null>,
) {
  return apiRequest(`${REPORTS_BASE}/ledger`, { token, params: cleanParams(params) })
}

export type AccountListItem = {
  _id: string
  accountCode?: string
  accountName?: string
  accountType?: string
}

export async function fetchAccountsForLedger(token: string) {
  return apiRequest<{ success?: boolean; accounts?: AccountListItem[] }>(ACCOUNTS_BASE, {
    token,
    params: { page: 1, limit: 500 },
  })
}

export type AccountEnquiryMetals = {
  goldPrice?: number
  silverPrice?: number
  priceCurrency?: string
  updatedAt?: string
  goldBalance?: number
  silverBalance?: number
  suppressMetalSpotMtm?: boolean
  bookedUnfixedRevaluation?: { total?: number }
}

export type AccountEnquiryBalances = {
  debitTotal?: number
  creditTotal?: number
  netBalance?: number
  netDirection?: string
  absoluteNetBalance?: number
  rateCurrencyBalance?: number
  rateCurrency?: string
}

export type AccountEnquiryStatementEntry = {
  _id?: string
  date?: string
  description?: string
  signedAmount?: number
  metalFixStatus?: string
  metalSignedWeight?: number
  metalCode?: string
  isMetalTrade?: boolean
}

export type AccountEnquiryPayload = {
  success?: boolean
  account?: {
    _id?: string
    accountCode?: string
    accountName?: string
    accountType?: string
    currency?: string
    description?: string
  }
  balances?: AccountEnquiryBalances
  metals?: AccountEnquiryMetals
  statement?: {
    limitValue?: number
    entryCount?: number
    entries?: AccountEnquiryStatementEntry[]
  }
  positions?: Array<{
    type?: string
    balance?: number
    price?: number
    currentValue?: number
  }>
}

export async function getAccountEnquiry(token: string, accountCode: string) {
  return apiRequest<AccountEnquiryPayload>(`${ACCOUNTS_BASE}/enquiry`, {
    token,
    params: { accountCode, statementLimit: 60, refresh: '1' },
  })
}
