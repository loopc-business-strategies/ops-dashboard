/**
 * Set sessionTimeoutMinutes to 0 (persistent until logout) for all tenants' admin settings.
 *
 *   node backend/scripts/migrate-persistent-session-all-tenants.js
 *   node backend/scripts/migrate-persistent-session-all-tenants.js --tenant=mg
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

async function migrateTenant(tenant) {
  const uri = getTenantUri(tenant)
  if (!uri) {
    console.log(JSON.stringify({ tenant, skipped: true, reason: 'missing URI' }))
    return
  }

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const db = conn.getClient().db()
  const col = db.collection('departmentstates')

  const row = await col.findOne({ module: 'admin' })
  const prev = row?.state?.sessionTimeoutMinutes

  if (!row) {
    await col.insertOne({
      module: 'admin',
      state: { sessionTimeoutMinutes: '0' },
      updatedAt: new Date(),
    })
    console.log(JSON.stringify({ tenant, action: 'inserted', previous: null, sessionTimeoutMinutes: '0' }))
    await conn.close()
    return
  }

  const result = await col.updateOne(
    { _id: row._id },
    {
      $set: {
        'state.sessionTimeoutMinutes': '0',
        updatedAt: new Date(),
      },
    },
  )

  console.log(
    JSON.stringify({
      tenant,
      action: 'updated',
      previous: prev ?? null,
      sessionTimeoutMinutes: '0',
      modified: result.modifiedCount,
    }),
  )
  await conn.close()
}

async function main() {
  const one = argValue('tenant', '')
  const tenants = one ? [normalizeTenant(one)].filter(Boolean) : TENANT_KEYS

  for (const tenant of tenants) {
    if (!TENANT_KEYS.includes(tenant)) {
      console.error(`Invalid tenant: ${tenant}`)
      process.exit(1)
    }
    await migrateTenant(tenant)
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
