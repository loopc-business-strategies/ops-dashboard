import { isMetalTransferType } from '../lib/money.mjs'

export function phase04VoucherLedger(ctx, findings) {
  const phase = '04-voucher-ledger'
  const { postedTx, ledgers, ledgersByRef, txById, accountById } = ctx
  let orphanLedger = 0

  for (const tx of postedTx) {
    const rows = ledgersByRef.get(String(tx._id)) || []
    const entity = { txId: String(tx._id), vocNo: tx?.voucherMeta?.vocNo || '', type: tx.type }
    const type = String(tx.type || '').toLowerCase()

    if (isMetalTransferType(type)) {
      findings.add({
        domain: 'ledger', phase, severity: 'PASS', code: 'TRANSFER_LEDGER_POLICY',
        message: 'Metal transfer: main cash ledger skipped by design (stock-only)', entity,
        actual: rows.length,
      })
      continue
    }

    if (rows.length === 0) {
      findings.add({
        domain: 'ledger', phase, severity: 'CRITICAL', code: 'MISSING_LEDGER',
        message: 'Posted voucher missing ledger entries', entity,
      })
      continue
    }

    for (const row of rows) {
      if (!row.debitAccountId || !row.creditAccountId) {
        findings.add({
          domain: 'ledger', phase, severity: 'ERROR', code: 'LEDGER_MISSING_ACCOUNT',
          message: 'Ledger row missing debit or credit account', entity: { ...entity, ledgerId: String(row._id) },
        })
      } else {
        if (!accountById.has(String(row.debitAccountId))) {
          findings.add({
            domain: 'ledger', phase, severity: 'ERROR', code: 'LEDGER_BAD_DEBIT_ACCOUNT',
            message: 'Ledger debit account not found in CoA', entity: { ...entity, ledgerId: String(row._id) },
          })
        }
        if (!accountById.has(String(row.creditAccountId))) {
          findings.add({
            domain: 'ledger', phase, severity: 'ERROR', code: 'LEDGER_BAD_CREDIT_ACCOUNT',
            message: 'Ledger credit account not found in CoA', entity: { ...entity, ledgerId: String(row._id) },
          })
        }
      }
    }

    findings.add({
      domain: 'ledger', phase, severity: 'PASS', code: 'VOUCHER_LEDGER_LINKED',
      message: `Posted voucher has ${rows.length} ledger row(s)`, entity,
    })
  }

  for (const row of ledgers) {
    if (!row.referenceId) {
      // journals / opening may have null reference — informational
      const rt = String(row.referenceType || '').toLowerCase()
      if (!['journal', 'bank_jv', 'reversal'].includes(rt)) {
        findings.add({
          domain: 'ledger', phase, severity: 'WARNING', code: 'LEDGER_NULL_REF',
          message: 'Ledger without referenceId', entity: { ledgerId: String(row._id), referenceType: rt },
        })
      }
      continue
    }
    const tx = txById.get(String(row.referenceId))
    if (!tx && !['journal', 'bank_jv', 'direct_deal', 'reversal'].includes(String(row.referenceType || '').toLowerCase())) {
      orphanLedger += 1
      findings.add({
        domain: 'ledger', phase, severity: 'ERROR', code: 'ORPHAN_LEDGER',
        message: 'Ledger referenceId not found in transactions', entity: {
          ledgerId: String(row._id),
          referenceId: String(row.referenceId),
          referenceType: row.referenceType,
        },
      })
    }
  }

  return { orphanLedger }
}
