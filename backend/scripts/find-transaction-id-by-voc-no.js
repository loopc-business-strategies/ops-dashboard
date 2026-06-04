/**
 * Look up a transaction Mongo _id by voucher doc number (voucherMeta.vocNo) for void/API use.
 *
 * Usage (from backend/ or repo root):
 *   node scripts/find-transaction-id-by-voc-no.js --tenant=loopc --voc-no=Rec/2026/0001 --type=receipt
 *   node backend/scripts/find-transaction-id-by-voc-no.js --tenant=loopc --voc-no=Rec/2026/0001 --type=receipt
 *
 * Env: MONGO_URI_LOOPC (or matching URI for --tenant), loads backend/.env next to this file.
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
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

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function main() {
  const tenant = normalizeTenant(argValue('tenant', 'loopc')) || 'loopc'
  if (!TENANT_KEYS.includes(tenant)) {
    console.error(`Invalid --tenant (use one of: ${TENANT_KEYS.join(', ')})`)
    process.exit(1)
  }

  const vocNo = String(argValue('voc-no', '') || argValue('vocNo', '')).trim()
  if (!vocNo) {
    console.error('Required: --voc-no=Rec/2026/0001 (exact or unique match)')
    process.exit(1)
  }

  const type = String(argValue('type', 'receipt')).trim().toLowerCase()
  const uri = getTenantUri(tenant)
  if (!uri) {
    console.error(`Missing Mongo URI for tenant ${tenant}`)
    process.exit(1)
  }

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const db = conn.getClient().db()
  const rx = new RegExp(`^${escapeRegExp(vocNo)}$`, 'i')

  const rows = await db.collection('transactions').find({
    isDeleted: { $ne: true },
    type,
    'voucherMeta.vocNo': rx,
  }).project({
    _id: 1,
    status: 1,
    type: 1,
    amount: 1,
    currency: 1,
    date: 1,
    voucherMeta: 1,
  }).sort({ createdAt: -1 }).limit(5).toArray()

  await conn.close()

  if (!rows.length) {
    console.log(JSON.stringify({ tenant, vocNo, type, found: 0, message: 'No matching active transaction.' }, null, 2))
    process.exit(1)
  }

  if (rows.length > 1) {
    console.log(JSON.stringify({
      tenant,
      vocNo,
      type,
      found: rows.length,
      warning: 'Multiple matches; pick the correct _id manually.',
      candidates: rows.map((r) => ({
        id: String(r._id),
        status: r.status,
        vocNo: r.voucherMeta?.vocNo,
        date: r.date,
        amount: r.amount,
      })),
    }, null, 2))
    process.exit(2)
  }

  const tx = rows[0]
  const id = String(tx._id)
  const out = {
    tenant,
    transactionId: id,
    status: tx.status,
    type: tx.type,
    vocNo: tx.voucherMeta?.vocNo,
    amount: tx.amount,
    currency: tx.currency,
    date: tx.date,
    voidCurlExample: `curl -sS -X POST \"https://YOUR_API/api/erp-accounting/transactions/${id}/void\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer YOUR_JWT\" -H \"X-Tenant: ${tenant}\" -d \"{\\\"reason\\\":\\\"Void receipt ${vocNo} (min 8 chars)\\\",\\\"confirmToken\\\":\\\"YOUR_DESTRUCTIVE_ADMIN_CONFIRM_TOKEN\\\"}\"`,
  }
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
