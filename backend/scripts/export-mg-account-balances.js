require('dotenv').config()
const dns = require('dns')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

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

    const [accounts, ledgers] = await Promise.all([
      db.collection('chartofaccounts').find({ isActive: true }).project({ _id: 1, accountCode: 1, accountName: 1, accountType: 1, currency: 1 }).toArray(),
      db.collection('ledgers').find({ isDeleted: { $ne: true } }).project({ debitAccountId: 1, creditAccountId: 1, amount: 1 }).toArray(),
    ])

    const totals = new Map()
    for (const acc of accounts) {
      totals.set(String(acc._id), {
        accountId: String(acc._id),
        accountCode: String(acc.accountCode || '').trim(),
        accountName: String(acc.accountName || '').trim(),
        accountType: String(acc.accountType || '').trim(),
        currency: String(acc.currency || 'USD').trim(),
        debit: 0,
        credit: 0,
      })
    }

    for (const row of ledgers) {
      const amount = Number(row.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue
      const drId = String(row.debitAccountId || '')
      const crId = String(row.creditAccountId || '')
      if (!totals.has(drId)) continue
      if (!totals.has(crId)) continue
      totals.get(drId).debit += amount
      totals.get(crId).credit += amount
    }

    const rows = [...totals.values()]
      .map((row) => {
        const debit = money(row.debit)
        const credit = money(row.credit)
        const net = money(debit - credit)
        return {
          ...row,
          debit,
          credit,
          net,
          balanceSide: net > 0 ? 'DR' : (net < 0 ? 'CR' : 'ZERO'),
        }
      })
      .filter((row) => row.debit !== 0 || row.credit !== 0)
      .sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode), undefined, { numeric: true }))

    const totalDebit = money(rows.reduce((s, r) => s + r.debit, 0))
    const totalCredit = money(rows.reduce((s, r) => s + r.credit, 0))
    const trialImbalance = money(totalDebit - totalCredit)

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const outDir = path.join(__dirname, '..', 'reports')
    fs.mkdirSync(outDir, { recursive: true })

    const jsonPath = path.join(outDir, `mg-account-balances-${stamp}.json`)
    const csvPath = path.join(outDir, `mg-account-balances-${stamp}.csv`)

    const payload = {
      generatedAt: new Date().toISOString(),
      tenant: 'MG',
      totals: {
        lines: rows.length,
        totalDebit,
        totalCredit,
        trialImbalance,
        trialBalanced: Math.abs(trialImbalance) < 0.01,
      },
      rows,
    }

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2))

    const header = ['accountCode', 'accountName', 'accountType', 'currency', 'debit', 'credit', 'net', 'balanceSide', 'accountId']
    const lines = [header.join(',')]
    for (const row of rows) {
      const cells = [
        row.accountCode,
        row.accountName,
        row.accountType,
        row.currency,
        row.debit.toFixed(2),
        row.credit.toFixed(2),
        row.net.toFixed(2),
        row.balanceSide,
        row.accountId,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`)
      lines.push(cells.join(','))
    }
    lines.push(`"TOTAL","","","","${totalDebit.toFixed(2)}","${totalCredit.toFixed(2)}","${trialImbalance.toFixed(2)}","${Math.abs(trialImbalance) < 0.01 ? 'BALANCED' : 'UNBALANCED'}",""`)
    fs.writeFileSync(csvPath, lines.join('\n'))

    console.log(JSON.stringify({ generatedAt: payload.generatedAt, totals: payload.totals, jsonPath, csvPath, preview: rows }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
