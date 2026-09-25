import { baseAmount, toMoney, withinMoneyTol } from '../lib/money.mjs'

/** Compute enquiry-style net = opening + Dr − Cr for each account. */
export function phase06AccountBalances(ctx, findings) {
  const phase = '06-account-balances'
  const { accounts, ledgers } = ctx
  const totals = new Map()

  for (const a of accounts) {
    totals.set(String(a._id), {
      code: a.accountCode,
      name: a.accountName,
      type: a.accountType,
      opening: Number(a.openingBalance || 0),
      debits: 0,
      credits: 0,
    })
  }

  for (const row of ledgers) {
    const amt = baseAmount(row.amount, row.exchangeRate)
    if (!(amt > 0)) continue
    const dr = String(row.debitAccountId || '')
    const cr = String(row.creditAccountId || '')
    if (totals.has(dr)) totals.get(dr).debits = toMoney(totals.get(dr).debits + amt)
    if (totals.has(cr)) totals.get(cr).credits = toMoney(totals.get(cr).credits + amt)
  }

  const balances = []
  for (const [id, t] of totals.entries()) {
    const calculated = toMoney(t.opening + t.debits - t.credits)
    balances.push({
      accountId: id,
      accountCode: t.code,
      accountName: t.name,
      accountType: t.type,
      opening: t.opening,
      debits: t.debits,
      credits: t.credits,
      calculatedClosing: calculated,
    })
    // No separate stored closing — PASS when formula applied (informational consistency)
    findings.add({
      domain: 'ledger', phase, severity: 'PASS', code: 'ACCOUNT_BALANCE_COMPUTED',
      message: `Computed closing for ${t.code}`, entity: { accountId: id, code: t.code },
      actual: calculated,
    })
  }

  return { balances }
}
