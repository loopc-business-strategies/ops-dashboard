#!/usr/bin/env node
/**
 * READ-ONLY tenant isolation audit.
 * Fingerprints MONGO_URI_* (no passwords) and compares MG vs VB for clone leftovers.
 * Never writes to MongoDB.
 *
 *   npm run audit:tenant-isolation
 *   npm run audit:tenant-isolation -- --from-railway
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

dns.setServers(
  (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(root, 'backend', '.env'),
})

const mongoose = require(path.join(root, 'backend', 'node_modules', 'mongoose'))
const { getTenantKeys, getTenantConfig } = require(path.join(root, 'backend', 'config', 'tenantRegistry'))
const {
  fingerprintMongoUri,
  redactMongoUri,
  findTenantUriCollisions,
} = require(path.join(root, 'backend', 'utils', 'mongoUriFingerprint'))

const MASTER_COLLECTIONS = new Set(['chartofaccounts', 'accountmappings', 'currencies'])
const SAMPLE_LIMIT = 8

const FIELD_HINTS = [
  { keys: ['email', 'Email'], label: 'email' },
  { keys: ['phone', 'phoneNumber', 'mobile', 'Phone'], label: 'phone' },
  { keys: ['name', 'fullName', 'username'], label: 'name' },
  { keys: ['voucherNo', 'voucherNumber', 'invoiceNo', 'invoiceNumber', 'documentNumber'], label: 'document-no' },
  { keys: ['accountCode', 'code', 'sku'], label: 'code' },
]

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function loadRailwayVars(environment = 'production') {
  const r = spawnSync(
    'railway',
    ['variable', 'list', '-s', 'ops-dashboard', '-e', environment, '--json'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  )
  const raw = `${r.stdout || ''}\n${r.stderr || ''}`
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) {
    throw new Error(`Failed to load Railway vars (${environment}). Log in with railway CLI or use backend/.env.`)
  }
  return JSON.parse(raw.slice(start, end + 1))
}

function collectEnv(fromRailway) {
  const extra = fromRailway ? loadRailwayVars('production') : {}
  const merged = { ...process.env, ...extra }
  return getTenantKeys().map((key) => {
    const envVar = getTenantConfig(key)?.envVar || `MONGO_URI_${key.toUpperCase()}`
    return { tenant: key, envVar, uri: String(merged[envVar] || '').trim() }
  })
}

function pick(doc, keys) {
  for (const key of keys) {
    const value = doc?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim().toLowerCase()
  }
  return ''
}

function indexDocs(docs) {
  const byId = new Map()
  const byField = new Map()
  for (const doc of docs) {
    const id = String(doc?._id || '')
    if (id) byId.set(id, doc)
    for (const hint of FIELD_HINTS) {
      const value = pick(doc, hint.keys)
      if (!value) continue
      const bucketKey = `${hint.label}:${value}`
      if (!byField.has(bucketKey)) byField.set(bucketKey, [])
      byField.get(bucketKey).push(id)
    }
  }
  return { byId, byField }
}

function uniqueSample(ids) {
  return [...new Set(ids.filter(Boolean))].slice(0, SAMPLE_LIMIT)
}

async function loadCollectionDocs(uri, collectionName) {
  const conn = await mongoose.createConnection(uri, {
    autoIndex: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 15000,
  }).asPromise()
  try {
    const names = (await conn.db.listCollections().toArray()).map((c) => c.name)
    if (!names.includes(collectionName)) return []
    return conn.db.collection(collectionName).find({}).project({ password: 0 }).limit(20000).toArray()
  } finally {
    await conn.close()
  }
}

async function listCollections(uri) {
  const conn = await mongoose.createConnection(uri, {
    autoIndex: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 15000,
  }).asPromise()
  try {
    return (await conn.db.listCollections().toArray())
      .map((c) => c.name)
      .filter((n) => !n.startsWith('system.'))
      .sort()
  } finally {
    await conn.close()
  }
}

function compareCollection(name, mgDocs, vbDocs) {
  const mg = indexDocs(mgDocs)
  const vb = indexDocs(vbDocs)
  const idHits = []
  for (const id of vb.byId.keys()) {
    if (mg.byId.has(id)) idHits.push(id)
  }
  const fieldHits = []
  for (const [bucket, vbIds] of vb.byField.entries()) {
    if (mg.byField.has(bucket)) {
      fieldHits.push({ bucket, sampleIds: uniqueSample(vbIds) })
    }
  }
  const suspected = new Set([...idHits, ...fieldHits.flatMap((row) => row.sampleIds)])
  const master = MASTER_COLLECTIONS.has(name)
  let reason = ''
  if (idHits.length) reason = 'identical Mongo _id values in MG and VB'
  else if (fieldHits.length) reason = `matching ${fieldHits[0].bucket.split(':')[0]} values in MG and VB`
  if (master && suspected.size) {
    reason = `${reason || 'overlap'} (allowlisted master/config collection — expected if CoA was bootstrapped)`
  }
  return {
    collection: name,
    vbCount: vbDocs.length,
    mgCount: mgDocs.length,
    suspectedCount: suspected.size,
    identicalIds: idHits.length,
    fieldMatches: fieldHits.length,
    sampleIds: uniqueSample([...idHits, ...fieldHits.flatMap((row) => row.sampleIds)]),
    reason: suspected.size ? reason : '',
    recommendedAction: !suspected.size
      ? 'none'
      : (master
        ? 'Keep unless VB should use a distinct chart; do not treat as operational clone.'
        : 'Do not delete automatically. Review sample IDs, then approve a gated quarantine if they are MG copies.'),
  }
}

function renderReport({ fingerprints, collisions, rows, skipped }) {
  const lines = [
    '# Venus data contamination report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report is **read-only**. No MongoDB documents were modified.',
    '',
    '## Tenant URI fingerprints (host/database only)',
    '',
  ]
  for (const row of fingerprints) {
    lines.push(`- **${row.tenant}** (${row.envVar}): \`${row.fingerprint}\``)
  }
  lines.push('')
  if (collisions.length) {
    lines.push('## URI collisions')
    lines.push('')
    for (const err of collisions) lines.push(`- ${err}`)
    lines.push('')
  }
  if (skipped) {
    lines.push(`## MG vs VB compare skipped`)
    lines.push('')
    lines.push(skipped)
    lines.push('')
    lines.push('Operator: set `MONGO_URI_MG` and `MONGO_URI_VB` (or pass `--from-railway`) and re-run.')
    lines.push('')
    return lines.join('\n')
  }
  lines.push('## MG vs VB collection overlap')
  lines.push('')
  lines.push('| collection | VB records | MG records | suspected overlap | reason | sample IDs | recommended action |')
  lines.push('| --- | ---: | ---: | ---: | --- | --- | --- |')
  for (const row of rows) {
    lines.push(
      `| ${row.collection} | ${row.vbCount} | ${row.mgCount} | ${row.suspectedCount} | ${row.reason || '—'} | ${row.sampleIds.join(', ') || '—'} | ${row.recommendedAction} |`,
    )
  }
  lines.push('')
  lines.push('## Next step')
  lines.push('')
  lines.push('Stop. Do not run any VB cleanup until this report is reviewed and explicitly approved.')
  lines.push('')
  return lines.join('\n')
}

async function main() {
  const fromRailway = hasFlag('from-railway')
  let entries
  try {
    entries = collectEnv(fromRailway)
  } catch (err) {
    console.error(err.message)
    console.error('Falling back to process env / backend/.env only.')
    entries = collectEnv(false)
  }

  const fingerprints = entries.map((row) => ({
    tenant: row.tenant,
    envVar: row.envVar,
    fingerprint: row.uri ? redactMongoUri(row.uri) : '(not set)',
  }))

  console.log('Tenant Mongo fingerprints:')
  for (const row of fingerprints) {
    console.log(`  ${row.tenant}: ${row.fingerprint}`)
  }

  const collisions = findTenantUriCollisions(entries)
  if (collisions.length) {
    for (const err of collisions) console.error(`COLLISION: ${err}`)
  }

  const mg = entries.find((e) => e.tenant === 'mg')
  const vb = entries.find((e) => e.tenant === 'vb')
  let skipped = ''
  let rows = []

  if (!mg?.uri || !vb?.uri) {
    skipped = 'MONGO_URI_MG and/or MONGO_URI_VB are not set in this environment.'
    console.warn(skipped)
  } else if (fingerprintMongoUri(mg.uri) === fingerprintMongoUri(vb.uri)) {
    skipped = 'MG and VB resolve to the same host/database. Refusing compare (would be a self-scan).'
    console.error(skipped)
  } else {
    const [mgCols, vbCols] = await Promise.all([listCollections(mg.uri), listCollections(vb.uri)])
    const names = [...new Set([...mgCols, ...vbCols])].sort()
    for (const name of names) {
      const [mgDocs, vbDocs] = await Promise.all([
        mgCols.includes(name) ? loadCollectionDocs(mg.uri, name) : Promise.resolve([]),
        vbCols.includes(name) ? loadCollectionDocs(vb.uri, name) : Promise.resolve([]),
      ])
      rows.push(compareCollection(name, mgDocs, vbDocs))
    }
  }

  const report = renderReport({ fingerprints, collisions, rows, skipped })
  const outDir = path.join(root, 'reports')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'VENUS-DATA-CONTAMINATION-REPORT.md')
  fs.writeFileSync(outPath, report, 'utf8')
  console.log(`\nWrote ${path.relative(root, outPath)}`)
  if (collisions.length) process.exitCode = 2
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
