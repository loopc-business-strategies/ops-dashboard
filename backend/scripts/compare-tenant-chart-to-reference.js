/**
 * Compare chart of accounts and account mappings against a reference tenant (default mg).
 * Helps align CG/LoopC with MG account *codes* and mapping wiring (not amounts).
 *
 * Usage:
 *   node backend/scripts/compare-tenant-chart-to-reference.js
 *   node backend/scripts/compare-tenant-chart-to-reference.js --reference=mg --others=cg,loopc
 *
 * Env: MONGO_URI_MG, MONGO_URI_CG, MONGO_URI_LOOPC
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

const refTenant = normalizeTenant(argValue('reference', 'mg')) || 'mg'
const othersRaw = argValue('others', 'cg,loopc')
const otherTenants = othersRaw
  .split(',')
  .map((s) => normalizeTenant(s))
  .filter(Boolean)
  .filter((k) => k !== refTenant)

async function loadAccountIndex(db) {
  const rows = await db.collection('chartofaccounts').find({ isDeleted: { $ne: true } }).project({
    accountCode: 1,
    accountName: 1,
    isActive: 1,
  }).toArray()
  const byCode = new Map()
  for (const r of rows) {
    const code = String(r.accountCode || '').trim()
    if (!code) continue
    byCode.set(code, r)
  }
  return { byCode, count: rows.length }
}

async function loadMappingsWithCodes(db) {
  const maps = await db.collection('accountmappings').find({}).toArray()
  const ids = new Set()
  for (const m of maps) {
    if (m.debitAccountId) ids.add(String(m.debitAccountId))
    if (m.creditAccountId) ids.add(String(m.creditAccountId))
  }
  if (!ids.size) return []
  const oidStrings = [...ids].filter((id) => /^[a-f\d]{24}$/i.test(id))
  const oids = oidStrings.map((id) => new mongoose.Types.ObjectId(id))
  const accs = await db.collection('chartofaccounts').find({ _id: { $in: oids } }).project({ accountCode: 1 }).toArray()
  const idToCode = new Map(accs.map((a) => [String(a._id), String(a.accountCode || '').trim()]))

  return maps.map((m) => ({
    mappingType: m.mappingType,
    debitCode: idToCode.get(String(m.debitAccountId)) || '',
    creditCode: idToCode.get(String(m.creditAccountId)) || '',
    isActive: m.isActive !== false,
  }))
}

async function compareOne(otherKey) {
  const refUri = getTenantUri(refTenant)
  const othUri = getTenantUri(otherKey)
  if (!refUri || !othUri) {
    return { other: otherKey, error: 'missing_uri' }
  }

  const refConn = await mongoose.createConnection(refUri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const othConn = await mongoose.createConnection(othUri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const refDb = refConn.getClient().db()
  const othDb = othConn.getClient().db()

  const refIdx = await loadAccountIndex(refDb)
  const othIdx = await loadAccountIndex(othDb)

  const missingOnOther = []
  for (const code of refIdx.byCode.keys()) {
    if (!othIdx.byCode.has(code)) missingOnOther.push(code)
  }
  const extraOnOther = []
  for (const code of othIdx.byCode.keys()) {
    if (!refIdx.byCode.has(code)) extraOnOther.push(code)
  }

  const refMaps = await loadMappingsWithCodes(refDb)
  const othMaps = await loadMappingsWithCodes(othDb)
  const othByType = new Map(othMaps.map((m) => [String(m.mappingType || '').toLowerCase(), m]))

  const mappingDiffs = []
  for (const rm of refMaps) {
    const key = String(rm.mappingType || '').toLowerCase()
    const om = othByType.get(key)
    if (!om) {
      mappingDiffs.push({ mappingType: rm.mappingType, issue: 'missing_on_other' })
      continue
    }
    if (rm.debitCode !== om.debitCode || rm.creditCode !== om.creditCode) {
      mappingDiffs.push({
        mappingType: rm.mappingType,
        issue: 'code_mismatch',
        reference: { debit: rm.debitCode, credit: rm.creditCode },
        other: { debit: om.debitCode, credit: om.creditCode },
      })
    }
  }

  await refConn.close()
  await othConn.close()

  return {
    reference: refTenant,
    other: otherKey,
    chart: {
      referenceAccountCount: refIdx.count,
      otherAccountCount: othIdx.count,
      missingAccountCodesOnOther: missingOnOther.sort(),
      extraAccountCodesOnOtherVsReference: extraOnOther.sort().slice(0, 200),
      extraTotal: extraOnOther.length,
    },
    mappings: {
      mismatchOrMissing: mappingDiffs,
    },
  }
}

async function main() {
  if (!TENANT_KEYS.includes(refTenant)) {
    console.error('Invalid --reference')
    process.exit(1)
  }
  for (const o of otherTenants) {
    const report = await compareOne(o)
    console.log(JSON.stringify(report, null, 2))
  }
  console.log('\nUse bootstrap / manual chart setup to add missing codes; use Account Mappings UI or')
  console.log('scripts like set-fx-mapping-to-cash-all-tenants.js where applicable.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
