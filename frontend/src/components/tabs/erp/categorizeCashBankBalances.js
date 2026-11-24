/**
 * Split dashboard liquid-asset rows into Bank / Cash / Other for the ERP card.
 * Prefer allCashBankBalances; fall back to concatenated bankBalances + cashBalances.
 */

function rowKey(row) {
  return `${String(row?.accountCode || '').trim()}::${String(row?.accountName || '').trim()}`
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

export function cashBankBalanceGroups(dashboard) {
  return categorizeCashBankBalances(collectCashBankBalanceRows(dashboard))
}
