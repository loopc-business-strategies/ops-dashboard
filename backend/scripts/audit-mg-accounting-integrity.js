require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const isUnfixed = (tx) => {
  const v = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
  return ['unfixed', 'non-fixing', 'non_fixing', 'nonfixing'].includes(v)
}

const typeNeedsBaseLedger = (tx) => {
  const t = String(tx?.type || '').toLowerCase()
  if (['receipt', 'payment', 'expense', 'payroll'].includes(t)) return true
  if (['sale', 'purchase'].includes(t)) return !isUnfixed(tx)
  return true
}

const lc = (value) => String(value || '').trim().toLowerCase()
const money = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100

async function main() {
  const uri = process.env.MONGO_URI_MG
  if (!uri) throw new Error('Missing MONGO_URI_MG')

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  }).asPromise()

  try {
    const db = conn.getClient().db()

    const [accounts, transactions, ledgers] = await Promise.all([
      db.collection('chartofaccounts').find({ isActive: true }).project({ _id: 1, accountCode: 1, accountName: 1, accountType: 1 }).toArray(),
      db.collection('transactions').find({ isDeleted: { $ne: true } }).project({
        _id: 1, type: 1, status: 1, amount: 1, currency: 1, exchangeRate: 1,
        debitAccountId: 1, creditAccountId: 1, createdAt: 1, updatedAt: 1,
        voucherMeta: 1,
      }).toArray(),
      db.collection('ledgers').find({ isDeleted: { $ne: true } }).project({
        _id: 1, referenceType: 1, referenceId: 1, debitAccountId: 1, creditAccountId: 1,
        amount: 1, currency: 1, exchangeRate: 1, description: 1, createdAt: 1,
      }).toArray(),
    ])

    const accountById = new Map(accounts.map((a) => [String(a._id), a]))
    const postedTx = transactions.filter((t) => String(t.status).toLowerCase() === 'posted')

    const ledgersByRef = new Map()
    for (const row of ledgers) {
      if (!row.referenceId) continue
      const key = String(row.referenceId)
      if (!ledgersByRef.has(key)) ledgersByRef.set(key, [])
      ledgersByRef.get(key).push(row)
    }

    const voucherPostingIssues = []
    for (const tx of postedTx) {
      const rows = ledgersByRef.get(String(tx._id)) || []
      const baseRows = rows.filter((r) => String(r.referenceType || '').toLowerCase() === String(tx.type || '').toLowerCase())

      if (typeNeedsBaseLedger(tx) && baseRows.length === 0) {
        voucherPostingIssues.push({ txId: String(tx._id), type: tx.type, vocNo: tx?.voucherMeta?.vocNo || '', issue: 'Missing base ledger entry for posted voucher' })
      }

      if (!tx.debitAccountId || !tx.creditAccountId) {
        voucherPostingIssues.push({ txId: String(tx._id), type: tx.type, vocNo: tx?.voucherMeta?.vocNo || '', issue: 'Posted transaction has missing debitAccountId or creditAccountId' })
      }

      if (['receipt', 'payment'].includes(String(tx.type || '').toLowerCase())) {
        const lineItems = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
        const preferredLine = lineItems.find((line) => String(line?.acCode || '').trim()) || lineItems[0] || null
        const acCode = String(preferredLine?.acCode || '').trim()
        if (!acCode) {
          voucherPostingIssues.push({ txId: String(tx._id), type: tx.type, vocNo: tx?.voucherMeta?.vocNo || '', issue: 'Receipt/Payment has no selected settlement A/C code on line item' })
        } else {
          const coa = accounts.find((a) => String(a.accountCode || '').trim() === acCode)
          if (!coa) {
            voucherPostingIssues.push({ txId: String(tx._id), type: tx.type, vocNo: tx?.voucherMeta?.vocNo || '', issue: `Receipt/Payment A/C code ${acCode} not found in active chart of accounts` })
          }
        }
      }
    }

    const journalIssues = []
    const jvRows = ledgers.filter((r) => String(r.referenceType || '').toLowerCase() === 'journal')
    for (const row of jvRows) {
      if (!row.debitAccountId || !row.creditAccountId || Number(row.amount || 0) <= 0) {
        journalIssues.push({ ledgerId: String(row._id), referenceId: row.referenceId ? String(row.referenceId) : '', amount: Number(row.amount || 0), issue: 'Journal row has missing debit/credit account or non-positive amount' })
      }
    }

    const trial = { totalDebits: 0, totalCredits: 0, imbalance: 0 }
    const accountTotals = new Map()
    for (const row of ledgers) {
      const amt = Number(row.amount || 0)
      if (!Number.isFinite(amt) || amt <= 0) continue
      const drKey = String(row.debitAccountId || '')
      const crKey = String(row.creditAccountId || '')
      if (!accountTotals.has(drKey)) accountTotals.set(drKey, { debits: 0, credits: 0 })
      if (!accountTotals.has(crKey)) accountTotals.set(crKey, { debits: 0, credits: 0 })
      accountTotals.get(drKey).debits += amt
      accountTotals.get(crKey).credits += amt
      trial.totalDebits += amt
      trial.totalCredits += amt
    }
    trial.imbalance = money(trial.totalDebits - trial.totalCredits)

    let incomeTotal = 0
    let expenseTotal = 0
    let fxGainTotal = 0
    let fxLossTotal = 0
    const fxDetails = []

    for (const [accId, totals] of accountTotals.entries()) {
      const acc = accountById.get(accId)
      if (!acc) continue
      const accType = String(acc.accountType || '')
      const netCredit = money((totals.credits || 0) - (totals.debits || 0))
      const netDebit = money((totals.debits || 0) - (totals.credits || 0))
      if (accType === 'Income') incomeTotal += Math.max(netCredit, 0)
      if (accType === 'Expense') expenseTotal += Math.max(netDebit, 0)

      const name = lc(acc.accountName)
      const code = lc(acc.accountCode)
      const isFx = name.includes('exchange gain') || name.includes('exchange loss') || name.includes('fx gain') || name.includes('fx loss') || code === '4190' || code === '5190'
      if (isFx) {
        const gain = Math.max(netCredit, 0)
        const loss = Math.max(netDebit, 0)
        fxGainTotal += gain
        fxLossTotal += loss
        fxDetails.push({ accountCode: acc.accountCode, accountName: acc.accountName, accountType: acc.accountType, gain: money(gain), loss: money(loss), net: money(netCredit - netDebit) })
      }
    }

    const dupMap = new Map()
    for (const tx of transactions) {
      const vocNo = String(tx?.voucherMeta?.vocNo || '').trim()
      if (!vocNo) continue
      const k = `${String(tx.type || '').toLowerCase()}::${vocNo}`
      if (!dupMap.has(k)) dupMap.set(k, [])
      dupMap.get(k).push(tx)
    }

    const duplicateVouchers = []
    for (const [key, arr] of dupMap.entries()) {
      const activeArr = arr.filter((t) => t.isDeleted !== true)
      if (activeArr.length > 1) {
        const [type, vocNo] = key.split('::')
        duplicateVouchers.push({
          type,
          vocNo,
          count: activeArr.length,
          records: activeArr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map((t) => ({ txId: String(t._id), status: t.status, amount: Number(t.amount || 0), createdAt: t.createdAt, updatedAt: t.updatedAt })),
        })
      }
    }

    const output = {
      generatedAt: new Date().toISOString(),
      tenant: 'MG',
      totals: { activeAccounts: accounts.length, transactions: transactions.length, postedTransactions: postedTx.length, ledgers: ledgers.length, journalLedgers: jvRows.length },
      postedByType: postedTx.reduce((acc, tx) => { const t = String(tx.type || 'unknown').toLowerCase(); acc[t] = (acc[t] || 0) + 1; return acc }, {}),
      trialBalance: { totalDebits: money(trial.totalDebits), totalCredits: money(trial.totalCredits), imbalance: trial.imbalance, isBalanced: Math.abs(trial.imbalance) < 0.01 },
      profitLoss: { incomeTotal: money(incomeTotal), expenseTotal: money(expenseTotal), profitBeforeTax: money(incomeTotal - expenseTotal) },
      fx: { exchangeGainTotal: money(fxGainTotal), exchangeLossTotal: money(fxLossTotal), netFxImpact: money(fxGainTotal - fxLossTotal), details: fxDetails },
      issues: { voucherPostingIssuesCount: voucherPostingIssues.length, voucherPostingIssues, journalIssuesCount: journalIssues.length, journalIssues, duplicateVoucherNumbersCount: duplicateVouchers.length, duplicateVoucherNumbers: duplicateVouchers },
    }

    console.log(JSON.stringify(output, null, 2))

    if (voucherPostingIssues.length > 0 || journalIssues.length > 0 || duplicateVouchers.length > 0 || Math.abs(trial.imbalance) >= 0.01) {
      process.exitCode = 2
    }
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
