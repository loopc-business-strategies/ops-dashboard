export function phase05ChartOfAccounts(ctx, findings) {
  const phase = '05-chart-of-accounts'
  const { accounts, ledgers, mappings, accountByCode } = ctx

  const codeMap = new Map()
  for (const a of accounts) {
    const code = String(a.accountCode || '').trim()
    if (!code) {
      findings.add({
        domain: 'ledger', phase, severity: 'ERROR', code: 'COA_MISSING_CODE',
        message: 'Account missing accountCode', entity: { accountId: String(a._id), name: a.accountName },
      })
      continue
    }
    if (!codeMap.has(code)) codeMap.set(code, [])
    codeMap.get(code).push(String(a._id))
  }

  for (const [code, ids] of codeMap.entries()) {
    if (ids.length > 1) {
      findings.add({
        domain: 'ledger', phase, severity: 'CRITICAL', code: 'DUP_ACCOUNT_CODE',
        message: `Duplicate account code ${code}`, entity: { code, ids },
      })
    } else {
      findings.add({
        domain: 'ledger', phase, severity: 'PASS', code: 'ACCOUNT_CODE_UNIQUE',
        message: `Account code unique: ${code}`, entity: { code },
      })
    }
  }

  const usedInactive = new Set()
  for (const row of ledgers) {
    for (const id of [row.debitAccountId, row.creditAccountId]) {
      if (!id) continue
      const acc = ctx.accountById.get(String(id))
      if (acc && acc.isActive === false) usedInactive.add(String(id))
    }
  }
  for (const id of usedInactive) {
    const acc = ctx.accountById.get(id)
    findings.add({
      domain: 'ledger', phase, severity: 'ERROR', code: 'INACTIVE_ACCOUNT_USED',
      message: 'Inactive account used by posted ledger', entity: { accountId: id, code: acc?.accountCode, name: acc?.accountName },
    })
  }

  for (const m of mappings) {
    const debit = m.debitAccountId || m.debitAccount
    const credit = m.creditAccountId || m.creditAccount
    if (debit && !ctx.accountById.has(String(debit))) {
      findings.add({
        domain: 'ledger', phase, severity: 'ERROR', code: 'ORPHAN_MAPPING_DEBIT',
        message: 'Account mapping debit account missing', entity: { mappingId: String(m._id), type: m.type },
      })
    }
    if (credit && !ctx.accountById.has(String(credit))) {
      findings.add({
        domain: 'ledger', phase, severity: 'ERROR', code: 'ORPHAN_MAPPING_CREDIT',
        message: 'Account mapping credit account missing', entity: { mappingId: String(m._id), type: m.type },
      })
    }
  }

  // parent hierarchy
  for (const a of accounts) {
    if (a.parentAccountId && !ctx.accountById.has(String(a.parentAccountId))) {
      findings.add({
        domain: 'ledger', phase, severity: 'ERROR', code: 'MISSING_PARENT_ACCOUNT',
        message: 'Parent account missing', entity: { accountId: String(a._id), code: a.accountCode },
      })
    }
  }

  return { accountCount: accounts.length, duplicateCodes: [...codeMap.values()].filter((v) => v.length > 1).length }
}
