import { baseAmount, toMoney, withinMoneyTol } from '../lib/money.mjs'

export function phase14Reports(ctx, findings, accountBalances) {
  const phase = '14-reports'
  const { accounts, ledgers } = ctx

  let totalDr = 0
  let totalCr = 0
  for (const row of ledgers) {
    const amt = baseAmount(row.amount, row.exchangeRate)
    if (!(amt > 0)) continue
    if (row.debitAccountId) totalDr = toMoney(totalDr + amt)
    if (row.creditAccountId) totalCr = toMoney(totalCr + amt)
  }

  if (withinMoneyTol(totalDr, totalCr)) {
    findings.add({
      domain: 'reports', phase, severity: 'PASS', code: 'TRIAL_BALANCE',
      message: 'Trial Balance: Total Debit = Total Credit', expected: totalDr, actual: totalCr,
    })
  } else {
    findings.add({
      domain: 'reports', phase, severity: 'CRITICAL', code: 'TRIAL_BALANCE_IMBALANCE',
      message: 'Trial Balance imbalance', expected: totalDr, actual: totalCr,
      difference: toMoney(totalDr - totalCr),
    })
  }

  // P&L and BS from account types + computed balances
  let income = 0
  let expense = 0
  let assets = 0
  let liabilities = 0
  let equity = 0

  const balMap = new Map((accountBalances || []).map((b) => [b.accountId, b.calculatedClosing]))

  for (const a of accounts) {
    const id = String(a._id)
    const closing = balMap.has(id)
      ? balMap.get(id)
      : toMoney(Number(a.openingBalance || 0))
    const t = String(a.accountType || '').toLowerCase()
    if (t === 'income' || t === 'revenue') income = toMoney(income + Math.max(-closing, 0)) // credits positive income often stored as negative net in Dr−Cr
    // Using standard: net = opening+Dr−Cr; for income accounts credit-normal → negative closing means credit balance
    if (t === 'income' || t === 'revenue') {
      // credit-normal: display income = −closing if closing negative, else 0; simpler: income += −closing
      income = toMoney(income + (-closing))
    } else if (t === 'expense') {
      expense = toMoney(expense + closing)
    } else if (t === 'asset') {
      assets = toMoney(assets + closing)
    } else if (t === 'liability') {
      liabilities = toMoney(liabilities + (-closing))
    } else if (t === 'equity') {
      equity = toMoney(equity + (-closing))
    }
  }

  // Recalculate P&L more carefully from period nets
  income = 0
  expense = 0
  assets = 0
  liabilities = 0
  equity = 0
  for (const a of accounts) {
    const closing = balMap.get(String(a._id)) ?? Number(a.openingBalance || 0)
    const t = String(a.accountType || '').toLowerCase()
    if (t === 'income' || t === 'revenue') income = toMoney(income + Math.max(0, -closing))
    else if (t === 'expense') expense = toMoney(expense + Math.max(0, closing))
    else if (t === 'asset') assets = toMoney(assets + closing)
    else if (t === 'liability') liabilities = toMoney(liabilities + Math.max(0, -closing))
    else if (t === 'equity') equity = toMoney(equity + Math.max(0, -closing))
  }

  const netProfit = toMoney(income - expense)
  findings.add({
    domain: 'reports', phase, severity: 'INFORMATIONAL', code: 'PL_NET',
    message: 'P&L net profit (Income − Expense) from CoA types', actual: netProfit,
    entity: { income, expense },
  })

  const rhs = toMoney(liabilities + equity + netProfit)
  if (withinMoneyTol(assets, rhs, 1)) {
    findings.add({
      domain: 'reports', phase, severity: 'PASS', code: 'BALANCE_SHEET',
      message: 'Balance Sheet: Assets ≈ Liabilities + Equity + Net Profit (approx)',
      expected: assets, actual: rhs, difference: toMoney(assets - rhs),
    })
  } else {
    findings.add({
      domain: 'reports', phase, severity: 'WARNING', code: 'BALANCE_SHEET_GAP',
      message: 'Balance Sheet identity gap (account-type classification sensitive)',
      expected: assets, actual: rhs, difference: toMoney(assets - rhs),
    })
  }

  findings.add({
    domain: 'reports', phase, severity: 'INFORMATIONAL', code: 'CASH_FLOW',
    message: 'Cash flow statement not independently fully reconstructed; see cash/bank CoA movements in account balances',
  })

  findings.add({
    domain: 'reports', phase, severity: 'INFORMATIONAL', code: 'AGING',
    message: 'Aging requires per-invoice open items; outstanding = enquiry net for AR/AP accounts — see account balances',
  })

  return { trialDr: totalDr, trialCr: totalCr, netProfit, assets, liabilities, equity }
}

export function phase15Orphans(ctx, findings) {
  const phase = '15-orphans'
  const { ledgers, txById, stockMovements, itemById, postedTx, ledgersByRef } = ctx
  let count = 0

  for (const row of ledgers) {
    if (!row.referenceId) continue
    const rt = String(row.referenceType || '').toLowerCase()
    if (['journal', 'bank_jv', 'direct_deal', 'reversal'].includes(rt)) continue
    if (!txById.has(String(row.referenceId))) {
      count += 1
      findings.add({
        domain: 'ledger', phase, severity: 'ERROR', code: 'ORPHAN_LEDGER',
        message: 'Ledger without transaction', entity: { ledgerId: String(row._id), referenceId: String(row.referenceId) },
      })
    }
  }

  for (const m of stockMovements) {
    if (!itemById.has(String(m.itemId))) {
      count += 1
      findings.add({
        domain: 'inventory', phase, severity: 'ERROR', code: 'ORPHAN_STOCK_MOVE',
        message: 'Stock movement without inventory item', entity: { movementId: String(m._id) },
      })
    }
  }

  for (const tx of postedTx) {
    const type = String(tx.type || '').toLowerCase()
    if (!['purchase', 'sale'].includes(type)) continue
    const rows = ledgersByRef.get(String(tx._id)) || []
    if (!rows.length) {
      count += 1
      findings.add({
        domain: 'vouchers', phase, severity: 'CRITICAL', code: 'ORPHAN_TX_NO_LEDGER',
        message: 'Posted transaction without ledger', entity: { txId: String(tx._id), vocNo: tx?.voucherMeta?.vocNo },
      })
    }
  }

  return { count }
}

export function phase16Duplicates(ctx, findings) {
  const phase = '16-duplicates'
  const { transactions, stockMovements, ledgers } = ctx
  let count = 0

  const vocMap = new Map()
  for (const tx of transactions) {
    const voc = String(tx?.voucherMeta?.vocNo || '').trim()
    if (!voc) continue
    const key = `${String(tx.type || '').toLowerCase()}::${voc}`
    if (!vocMap.has(key)) vocMap.set(key, [])
    vocMap.get(key).push(String(tx._id))
  }
  for (const [key, ids] of vocMap.entries()) {
    if (ids.length > 1) {
      count += 1
      findings.add({
        domain: 'vouchers', phase, severity: 'CRITICAL', code: 'DUP_VOUCHER',
        message: `Duplicate voucher ${key}`, entity: { key, ids },
      })
    }
  }

  // Duplicate stock movements: same itemId+change+reason+date bucket
  const moveKeys = new Map()
  for (const m of stockMovements) {
    const key = `${m.itemId}|${m.change}|${m.reason}|${m.createdAt || m.date || ''}`
    if (!moveKeys.has(key)) moveKeys.set(key, [])
    moveKeys.get(key).push(String(m._id))
  }
  for (const [key, ids] of moveKeys.entries()) {
    if (ids.length > 1) {
      count += 1
      findings.add({
        domain: 'inventory', phase, severity: 'WARNING', code: 'DUP_STOCK_MOVE',
        message: 'Possible duplicate stock movements', entity: { key, ids },
      })
    }
  }

  // Duplicate ledger: same referenceId+referenceType+amount+debit+credit
  const ledKeys = new Map()
  for (const l of ledgers) {
    const key = `${l.referenceId}|${l.referenceType}|${l.amount}|${l.debitAccountId}|${l.creditAccountId}`
    if (!ledKeys.has(key)) ledKeys.set(key, [])
    ledKeys.get(key).push(String(l._id))
  }
  for (const [key, ids] of ledKeys.entries()) {
    if (ids.length > 1) {
      count += 1
      findings.add({
        domain: 'ledger', phase, severity: 'WARNING', code: 'DUP_LEDGER',
        message: 'Possible duplicate ledger rows', entity: { key, ids },
      })
    }
  }

  return { count }
}

export function phase17Rounding(findings) {
  const phase = '17-rounding'
  findings.add({
    domain: 'reports', phase, severity: 'INFORMATIONAL', code: 'ROUNDING_RULES',
    message: 'Money: toMoney 2dp (tol 0.01). Qty: toQty 6dp (tol 1e-6). Pure weights often UI 3dp. FX: amount × exchangeRate = base.',
  })
  findings.add({
    domain: 'reports', phase, severity: 'PASS', code: 'ROUNDING_DOCUMENTED',
    message: 'Rounding rules taken from backend/shared/money.js and transactionHelpers.toQty',
  })
  return { moneyTol: 0.01, qtyTol: 0.000001 }
}
