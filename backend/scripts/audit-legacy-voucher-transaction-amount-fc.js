/**
 * Find receipt/payment vouchers where transaction.amount looks like sum(amountLC)
 * instead of sum(amountFC) while document currency is not base — the legacy double-FX pattern.
 *
 * Correct pattern (current VoucherTab): amount ≈ sum(line.amountFC) in document currency.
 * Legacy bug: amount ≈ sum(line.amountLC) while amountLC is already base-equivalent.
 *
 * Usage:
 *   node backend/scripts/audit-legacy-voucher-transaction-amount-fc.js
 *   node backend/scripts/audit-legacy-voucher-transaction-amount-fc.js --tenant=cg
 *   node backend/scripts/audit-legacy-voucher-transaction-amount-fc.js --tenant=mg --limit=500
 *
 * Env: MONGO_URI_* via dotenv + ../config/tenants
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant, TENANT_KEYS } = require('../config/tenants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

function argValue(name, fallback) {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (!hit) return fallback
  return hit.slice(prefix.length).trim() || fallback
}

const LIMIT = Math.max(1, Math.min(5000, parseInt(argValue('limit', '2000'), 10) || 2000))
const tenantArg = normalizeTenant(argValue('tenant', ''))

function sumLineFC(lines) {
  if (!Array.isArray(lines)) return 0
  return lines.reduce((s, line) => {
    const v = Number(line?.amountFC ?? line?.amountFc ?? line?.amtFc ?? line?.headerAmt ?? 0)
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)
}

function sumLineLC(lines) {
  if (!Array.isArray(lines)) return 0
  return lines.reduce((s, line) => {
    const v = Number(
      line?.amountLC ?? line?.amountLc ?? line?.totalAmount ?? line?.metalAmount ?? line?.amountWithVAT ?? 0,
    )
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)
}

async function getBaseCurrencyCode(db) {
  const base = await db.collection('currencies').findOne({ baseCurrency: true, isActive: { $ne: false } })
  return String(base?.code || 'USD').trim().toUpperCase() || 'USD'
}

async function auditTenant(tenantKey) {
  const uri = getTenantUri(tenantKey)
  if (!uri) {
    console.warn(JSON.stringify({ tenant: tenantKey, error: 'missing_uri' }))
    return { tenant: tenantKey, error: 'missing_uri' }
  }

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const db = conn.getClient().db()
  const baseCode = await getBaseCurrencyCode(db)

  const cursor = db.collection('transactions').find(
    {
      type: { $in: ['receipt', 'payment'] },
      status: { $in: ['posted', 'approved', 'submitted', 'draft'] },
      'voucherMeta.lineItems.0': { $exists: true },
    },
    {
      projection: {
        type: 1,
        status: 1,
        amount: 1,
        currency: 1,
        date: 1,
        voucherMeta: 1,
        description: 1,
      },
    },
  ).sort({ date: -1 }).limit(LIMIT)

  const suspects = []
  const rows = await cursor.toArray()

  for (const tx of rows) {
    const docCur = String(tx.currency || baseCode).trim().toUpperCase() || baseCode
    if (docCur === baseCode) continue

    const lines = tx.voucherMeta?.lineItems || []
    const sumFC = sumLineFC(lines)
    const sumLC = sumLineLC(lines)
    if (sumFC < 1) continue

    const amt = Number(tx.amount || 0)
    if (!Number.isFinite(amt) || amt <= 0) continue

    const tolFc = Math.max(1, Math.abs(sumFC) * 1e-6)
    const tolLc = Math.max(0.01, Math.abs(sumLC) * 1e-4)

    const closeToLC = Math.abs(amt - sumLC) <= tolLc
    const closeToFC = Math.abs(amt - sumFC) <= tolFc
    const farFromFC = Math.abs(amt - sumFC) > tolFc

    if (closeToLC && !closeToFC && farFromFC && sumLC > 0 && Math.abs(sumFC - sumLC) > tolFc) {
      suspects.push({
        id: String(tx._id),
        type: tx.type,
        status: tx.status,
        docCurrency: docCur,
        baseCurrency: baseCode,
        amount: amt,
        sumFC,
        sumLC,
        vocNo: tx.voucherMeta?.vocNo || '',
        date: tx.date,
        description: String(tx.description || '').slice(0, 120),
      })
    }
  }

  await conn.close()

  const summary = {
    tenant: tenantKey,
    baseCurrency: baseCode,
    scanned: rows.length,
    suspects: suspects.length,
    sample: suspects.slice(0, 25),
  }
  console.log(JSON.stringify(summary, null, 2))
  return summary
}

async function main() {
  const tenants = tenantArg ? [tenantArg] : TENANT_KEYS
  const out = []
  for (const t of tenants) {
    if (!normalizeTenant(t)) continue
    out.push(await auditTenant(t))
  }
  console.log('\nRemediation: void/repost affected vouchers after fixing client, or post manual adjusting journals.')
  if (!out.some((x) => x.suspects > 0)) {
    console.log('No strong legacy-pattern matches in the scanned window (heuristic may miss edge cases).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
