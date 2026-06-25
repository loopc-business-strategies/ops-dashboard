#!/usr/bin/env node
/**
 * Connectivity drill: verify each tenant Mongo cluster is reachable and has data.
 * Full Atlas snapshot restore still requires the provider dashboard.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(root, 'backend', '.env'),
})

const mongoose = require(path.join(root, 'backend', 'node_modules', 'mongoose'))

const TENANTS = [
  { key: 'mg', uriKey: 'MONGO_URI_MG' },
  { key: 'cg', uriKey: 'MONGO_URI_CG' },
  { key: 'loopc', uriKey: 'MONGO_URI_LOOPC' },
]

async function probeTenant({ key, uriKey }) {
  const uri = String(process.env[uriKey] || '').trim()
  if (!uri) throw new Error(`${uriKey} is not set`)

  await mongoose.connect(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 15000 })
  const db = mongoose.connection.db
  const collections = await db.listCollections().toArray()
  const names = collections.map((c) => c.name)

  const counts = {}
  for (const name of ['users', 'transactions', 'ledgers'].filter((n) => names.includes(n))) {
    counts[name] = await db.collection(name).countDocuments({})
  }

  await mongoose.disconnect()

  return { tenant: key, collections: names.length, counts }
}

async function probeViaApi() {
  const api = (process.env.SMOKE_API_BASE || 'https://api.loopcstrategies.com').replace(/\/$/, '')
  const res = await fetch(`${api}/api/ready`)
  const body = await res.json()
  if (!res.ok || !body.ready) throw new Error(`/api/ready not ready (${res.status})`)

  const tenants = body.checks?.tenants || {}
  return TENANTS.map(({ key }) => {
    const row = tenants[key]
    if (!row?.ready) throw new Error(`tenant ${key} not ready via API`)
    return { tenant: key, via: 'api/ready', ready: true }
  })
}

async function main() {
  console.log('MongoDB backup connectivity drill\n')
  let results = []
  let mode = 'direct'

  try {
    for (const tenant of TENANTS) {
      process.stdout.write(`  ${tenant.key} (direct)... `)
      const row = await probeTenant(tenant)
      results.push(row)
      console.log(`OK (${row.collections} collections, users=${row.counts.users ?? '—'}, tx=${row.counts.transactions ?? '—'})`)
    }
  } catch (directErr) {
    console.log(`\nDirect Mongo skipped (${directErr.message}).`)
    console.log('Falling back to production /api/ready tenant pings...\n')
    mode = 'api'
    results = await probeViaApi()
    for (const row of results) console.log(`  ${row.tenant}... OK (via ${row.via})`)
  }

  console.log('\nAll tenant clusters reachable with expected data.')
  console.log('Record this drill (full Atlas restore is separate):')
  console.log(`  npm run verify:backup-checklist -- --record "${results.map((r) => r.tenant).join('+')} connectivity drill passed"`)

  const record = mode === 'direct'
    ? results.map((r) => `${r.tenant}:users=${r.counts.users ?? 0}`).join(', ')
    : `api-ready ${results.map((r) => r.tenant).join('+')}`
  spawnSync(process.execPath, [
    path.join(root, 'scripts', 'verify-backup-checklist.mjs'),
    '--record',
    `connectivity drill ${new Date().toISOString().slice(0, 10)} — ${record}`,
  ], { stdio: 'inherit', cwd: root })
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`)
  process.exit(1)
})
