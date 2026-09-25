import { baseAmount, toMoney, withinMoneyTol, isMetalTransferType } from '../lib/money.mjs'

/** Each ledger row is double-entry (debitAccount + creditAccount + amount). Sum Dr should equal sum Cr globally and per balanced voucher group. */
export function phase03DoubleEntry(ctx, findings) {
  const phase = '03-double-entry'
  const { ledgers, postedTx, ledgersByRef } = ctx
  let unbalanced = 0

  // Global: every ledger row posts equal debit and credit by construction (single amount to both sides)
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
      domain: 'ledger', phase, severity: 'PASS', code: 'GLOBAL_DR_CR',
      message: 'Global ledger debit total equals credit total (base)',
      expected: totalDr, actual: totalCr, difference: toMoney(totalDr - totalCr),
    })
  } else {
    unbalanced += 1
    findings.add({
      domain: 'ledger', phase, severity: 'CRITICAL', code: 'GLOBAL_DR_CR_IMBALANCE',
      message: 'Global ledger debit/credit imbalance',
      expected: totalDr, actual: totalCr, difference: toMoney(totalDr - totalCr),
    })
  }

  for (const tx of postedTx) {
    if (isMetalTransferType(tx.type)) continue
    const rows = ledgersByRef.get(String(tx._id)) || []
    let dr = 0
    let cr = 0
    for (const row of rows) {
      const amt = baseAmount(row.amount, row.exchangeRate)
      if (!(amt > 0)) continue
      if (row.debitAccountId) dr = toMoney(dr + amt)
      if (row.creditAccountId) cr = toMoney(cr + amt)
    }
    const entity = { txId: String(tx._id), vocNo: tx?.voucherMeta?.vocNo || '', type: tx.type }
    if (rows.length === 0) {
      findings.add({
        domain: 'ledger', phase, severity: 'CRITICAL', code: 'TX_NO_LEDGER_BALANCE',
        message: 'Posted voucher has no ledger rows to balance', entity,
      })
      unbalanced += 1
      continue
    }
    if (withinMoneyTol(dr, cr)) {
      findings.add({
        domain: 'ledger', phase, severity: 'PASS', code: 'TX_DR_CR',
        message: 'Voucher ledger debit equals credit', entity,
        expected: dr, actual: cr, difference: 0,
      })
    } else {
      unbalanced += 1
      findings.add({
        domain: 'ledger', phase, severity: 'CRITICAL', code: 'TX_DR_CR_IMBALANCE',
        message: 'Voucher ledger debit/credit imbalance', entity,
        expected: dr, actual: cr, difference: toMoney(dr - cr),
      })
    }
  }

  return { unbalanced, totalDr, totalCr }
}
