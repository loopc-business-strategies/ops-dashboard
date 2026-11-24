/**
 * Dashboard account-balance card helpers.
 * Prefer allAccountBalances (typed COA); fall back to liquid bank/cash lists.
 */

import { ACCOUNT_TYPES } from '../../../constants/accountTypes'

const ZERO_EPS = 0.005

const TYPE_LABELS = {
  Asset: 'Assets',
  Liability: 'Liabilities',
  Equity: 'Equity',
  Income: 'Income',
  Expense: 'Expenses',
  Other: 'Other',
}

function rowKey(row) {
  return `${String(row?.accountCode || '').trim()}::${String(row?.accountName || '').trim()}`
}

export function hasNonZeroBalance(row) {
  return Math.abs(Number(row?.balance || 0)) >= ZERO_EPS
}

export function collectCashBankBalanceRows(dashboard) {
  const all = Array.isArray(dashboard?.allCashBankBalances) ? dashboard.allCashBankBalances : []
  if (all.length) return all
  const bank = Array.isArray(dashboard?.bankBalances) ? dashboard.bankBalances : []
  const cash = Array.isArray(dashboard?.cashBalances) ? dashboard.cashBalances : []
  const seen = new Set()
  const merged = []
  for (const row of [...bank, ...cash]) {
    const key = rowKey(row)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(row)
  }
  return merged
}

export function collectAccountBalanceRows(dashboard) {
  const all = Array.isArray(dashboard?.allAccountBalances) ? dashboard.allAccountBalances : []
  if (all.length) return all
  return collectCashBankBalanceRows(dashboard).map((row) => ({
    ...row,
    accountType: row.accountType || 'Asset',
  }))
}

/** @deprecated Prefer categorizeAccountBalances — kept for bank/cash heuristics. */
export function categorizeCashBankBalances(rows = []) {
  const bank = []
  const cash = []
  const other = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const name = String(row?.accountName || '')
    const code = String(row?.accountCode || '')
    if (/bank/i.test(name) || /^101/.test(code)) {
      bank.push(row)
    } else if (/cash/i.test(name) || /^100/.test(code) || /^102/.test(code)) {
      cash.push(row)
    } else {
      other.push(row)
    }
  }
  const byCode = (a, b) => String(a.accountCode || '').localeCompare(String(b.accountCode || ''))
  bank.sort(byCode)
  cash.sort(byCode)
  other.sort(byCode)
  return { bank, cash, other }
}

export function categorizeAccountBalances(rows = [], { hideZero = true } = {}) {
  const buckets = Object.fromEntries([...ACCOUNT_TYPES, 'Other'].map((type) => [type, []]))
  const byCode = (a, b) => String(a.accountCode || '').localeCompare(String(b.accountCode || ''))

  for (const row of Array.isArray(rows) ? rows : []) {
    if (hideZero && !hasNonZeroBalance(row)) continue
    const type = String(row?.accountType || '').trim()
    const key = buckets[type] ? type : 'Other'
    buckets[key].push(row)
  }

  return [...ACCOUNT_TYPES, 'Other']
    .map((type) => {
      const list = buckets[type]
      list.sort(byCode)
      return {
        key: type.toLowerCase(),
        label: TYPE_LABELS[type] || type,
        rows: list,
      }
    })
    .filter((section) => section.rows.length > 0)
}

export function cashBankBalanceGroups(dashboard) {
  return categorizeCashBankBalances(collectCashBankBalanceRows(dashboard))
}

export function accountBalanceSections(dashboard, options = {}) {
  return categorizeAccountBalances(collectAccountBalanceRows(dashboard), options)
}
