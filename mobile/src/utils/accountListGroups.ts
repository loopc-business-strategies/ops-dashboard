import type { AccountListItem } from '@/src/api/erpReports'

export const ACCOUNT_TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as const

export type AccountListSection = {
  title: string
  data: AccountListItem[]
}

function accountTypeKey(accountType?: string): string {
  const raw = String(accountType || '').trim()
  if (!raw) return 'Other'
  const match = ACCOUNT_TYPE_ORDER.find((t) => t.toLowerCase() === raw.toLowerCase())
  return match || 'Other'
}

function compareAccounts(a: AccountListItem, b: AccountListItem): number {
  const nameA = String(a.accountName || a.accountCode || '').toLowerCase()
  const nameB = String(b.accountName || b.accountCode || '').toLowerCase()
  if (nameA !== nameB) return nameA.localeCompare(nameB)
  return String(a.accountCode || '').localeCompare(String(b.accountCode || ''))
}

function matchesSearch(account: AccountListItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    String(account.accountCode || '').toLowerCase().includes(q) ||
    String(account.accountName || '').toLowerCase().includes(q) ||
    String(account.accountType || '').toLowerCase().includes(q)
  )
}

export function groupAccountsByType(
  accounts: AccountListItem[],
  searchQuery = '',
): AccountListSection[] {
  const filtered = accounts.filter((a) => matchesSearch(a, searchQuery))
  const buckets = new Map<string, AccountListItem[]>()

  for (const account of filtered) {
    const key = accountTypeKey(account.accountType)
    const list = buckets.get(key) || []
    list.push(account)
    buckets.set(key, list)
  }

  const sections: AccountListSection[] = []
  const orderedTitles = [...ACCOUNT_TYPE_ORDER.map(String), 'Other']

  for (const title of orderedTitles) {
    const data = buckets.get(title)
    if (!data?.length) continue
    sections.push({ title, data: [...data].sort(compareAccounts) })
  }

  return sections
}
