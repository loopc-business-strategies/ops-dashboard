#!/usr/bin/env node
/**
 * Copy MongoDB collections between URIs (additive upsert by _id).
 *
 * Default: master/config collections only (chartofaccounts, accountmappings, currencies).
 * Operational copy requires --allow-operational-copy and I_UNDERSTAND=COPY-ALL-COLLECTIONS.
 *
 * Usage:
 *   node scripts/copy-mongo-database.mjs --source "$SRC_URI" --target "$DST_URI"
 *   node scripts/copy-mongo-database.mjs --source-env MONGO_URI_MG --target-env MONGO_URI_VB
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

dns.setServers(['8.8.8.8', '1.1.1.1'])
require(path.join(root, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(root, 'backend', '.env'),
})

const mongoose = require(path.join(root, 'backend', 'node_modules', 'mongoose'))

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (hit) return hit.slice(prefix.length)
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0) return process.argv[idx + 1] || fallback
  return fallback
}

function loadRailwayUri(envVar, environment = 'production') {
  const r = spawnSync(
    'railway',
    ['variable', 'list', '-s', 'ops-dashboard', '-e', environment, '--json'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  )
  const raw = `${r.stdout || ''}\n${r.stderr || ''}`
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error(`Failed to load Railway vars (${environment})`)
  const j = JSON.parse(raw.slice(start, end + 1))
  const v = String(j[envVar] || '').trim()
  if (!v) throw new Error(`${envVar} missing on Railway ${environment}`)
  return v
}

function withDbName(uri, dbName) {
  if (!dbName) return uri
  const normalized = String(uri).replace(/^mongodb(\+srv)?:\/\//, 'https://')
  const u = new URL(normalized)
  u.pathname = `/${dbName}`
  return u.toString().replace(/^https:\/\//, uri.startsWith('mongodb+srv') ? 'mongodb+srv://' : 'mongodb://')
}

function dbNameFromUri(uri) {
  try {
    const u = new URL(String(uri).replace(/^mongodb(\+srv)?:\/\//, 'https://'))
    return u.pathname.replace(/^\//, '') || ''
  } catch {
    return ''
  }
}

const MASTER_COLLECTIONS = new Set(['chartofaccounts', 'accountmappings', 'currencies'])

function fingerprint(uri) {
  try {
    const u = new URL(String(uri).replace(/^mongodb(\+srv)?:\/\//, 'https://'))
    const host = String(u.hostname || '').toLowerCase()
    const db = String(u.pathname || '').replace(/^\//, '').toLowerCase()
    return `${host}/${db}`
  } catch {
    return ''
  }
}

function redact(uri) {
  return String(uri || '').replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
}

async function copyDatabase(sourceUri, targetUri, { allowOperational = false } = {}) {
  console.log('Source:', redact(sourceUri))
  console.log('Target:', redact(targetUri))
  const source = await mongoose.createConnection(sourceUri, { autoIndex: false }).asPromise()
  const target = await mongoose.createConnection(targetUri, { autoIndex: false }).asPromise()
  try {
    const collections = await source.db.listCollections().toArray()
    let names = collections.map((c) => c.name).filter((n) => !n.startsWith('system.'))
    if (!allowOperational) {
      const skipped = names.filter((n) => !MASTER_COLLECTIONS.has(n))
      names = names.filter((n) => MASTER_COLLECTIONS.has(n))
      if (skipped.length) {
        console.log(`Skipping operational collections (${skipped.length}): ${skipped.slice(0, 12).join(', ')}${skipped.length > 12 ? '…' : ''}`)
      }
    }
    console.log(`Collections: ${names.length}`)
    let totalDocs = 0
    let upserted = 0
    for (const name of names) {
      const docs = await source.db.collection(name).find({}).toArray()
      totalDocs += docs.length
      if (!docs.length) {
        console.log(`  ${name}: 0 docs`)
        continue
      }
      let localUpsert = 0
      for (const doc of docs) {
        const { _id, ...rest } = doc
        const result = await target.db.collection(name).updateOne(
          { _id },
          { $set: { ...rest, _id } },
          { upsert: true },
        )
        if (result.upsertedCount > 0 || result.modifiedCount > 0) localUpsert += 1
      }
      upserted += localUpsert
      console.log(`  ${name}: ${docs.length} docs (wrote ${localUpsert})`)
    }
    console.log(`Done. docs=${totalDocs}, writes=${upserted}`)
    return { collections: names.length, totalDocs, upserted }
  } finally {
    await source.close()
    await target.close()
  }
}

async function main() {
  let sourceUri = arg('source')
  let targetUri = arg('target')
  const sourceEnv = arg('source-env')
  const targetEnv = arg('target-env')
  const sourceDb = arg('source-db')
  const targetDb = arg('target-db')
  const railwayEnv = arg('railway-env', 'production')

  if (sourceEnv) sourceUri = loadRailwayUri(sourceEnv, railwayEnv)
  if (targetEnv) targetUri = loadRailwayUri(targetEnv, railwayEnv)
  if (!sourceUri && process.env.SOURCE_MONGO_URI) sourceUri = process.env.SOURCE_MONGO_URI
  if (!targetUri && process.env.TARGET_MONGO_URI) targetUri = process.env.TARGET_MONGO_URI

  if (sourceDb) sourceUri = withDbName(sourceUri, sourceDb)
  if (targetDb) targetUri = withDbName(targetUri, targetDb)

  if (!sourceUri || !targetUri) {
    console.error('Need --source/--target or --source-env/--target-env (and optional --source-db/--target-db)')
    process.exit(1)
  }

  const srcFp = fingerprint(sourceUri)
  const dstFp = fingerprint(targetUri)
  if (srcFp && dstFp && srcFp === dstFp) {
    console.error('Refusing to copy a database onto itself')
    process.exit(1)
  }

  const allowOperational = process.argv.includes('--allow-operational-copy')
  if (allowOperational && process.env.I_UNDERSTAND !== 'COPY-ALL-COLLECTIONS') {
    console.error('Operational collection copy requires I_UNDERSTAND=COPY-ALL-COLLECTIONS')
    process.exit(1)
  }

  await copyDatabase(sourceUri, targetUri, { allowOperational })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
