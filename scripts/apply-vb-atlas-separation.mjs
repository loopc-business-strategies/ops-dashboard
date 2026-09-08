#!/usr/bin/env node
/**
 * Separate Venus Bullions onto a dedicated Atlas cluster URI.
 *
 * Prerequisites: Atlas project + vb_db user created; URI saved to:
 *   scripts/_tmp-vb-atlas-uri.txt
 * or env TARGET_MONGO_URI / VB_ATLAS_URI
 *
 * Steps:
 *  1) Copy MG cluster DB ops-dashboard-vb → target ops-dashboard
 *  2) Set Railway MONGO_URI_VB (production + staging with ops-dashboard-staging)
 *  3) Probe login/ready
 *  4) Optional --drop-source to drop ops-dashboard-vb on MG after verify
 *
 * Usage:
 *   node scripts/apply-vb-atlas-separation.mjs
 *   node scripts/apply-vb-atlas-separation.mjs --drop-source
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
import fs from 'node:fs'
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

const DROP_SOURCE = process.argv.includes('--drop-source')
const URI_FILE = path.join(root, 'scripts', '_tmp-vb-atlas-uri.txt')

function loadRailwayVars(environment) {
  const r = spawnSync(
    'railway',
    ['variable', 'list', '-s', 'ops-dashboard', '-e', environment, '--json'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  )
  const raw = `${r.stdout || ''}\n${r.stderr || ''}`
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error(`Railway vars failed (${environment})`)
  return JSON.parse(raw.slice(start, end + 1))
}

function setRailwayUri(environment, uri) {
  // Windows: pipe via PowerShell so `&` in query string is not mangled by cmd.
  const ps = `Get-Content -Raw -Path '${URI_FILE.replace(/'/g, "''")}' | ForEach-Object { $_.Trim() } | railway variable set MONGO_URI_VB --stdin -s ops-dashboard -e ${environment}`
  // Prefer writing the exact URI for this env to a temp then piping
  const tmp = path.join(root, 'scripts', `_tmp-vb-uri-${environment}.txt`)
  fs.writeFileSync(tmp, uri, { mode: 0o600 })
  try {
    const r = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', `Get-Content -Raw '${tmp.replace(/'/g, "''")}' | railway variable set MONGO_URI_VB --stdin -s ops-dashboard -e ${environment}`],
      { encoding: 'utf8' },
    )
    if (r.status !== 0) {
      throw new Error(`Failed to set MONGO_URI_VB on ${environment}: ${r.stderr || r.stdout || `status=${r.status}`}`)
    }
    console.log(`Railway ${environment}: MONGO_URI_VB updated`)
  } finally {
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
  }
}

function withDbName(uri, dbName) {
  const normalized = String(uri).replace(/^mongodb(\+srv)?:\/\//, 'https://')
  const u = new URL(normalized)
  u.pathname = `/${dbName}`
  const scheme = String(uri).startsWith('mongodb+srv') ? 'mongodb+srv://' : 'mongodb://'
  return u.toString().replace(/^https:\/\//, scheme)
}

function hostname(uri) {
  try {
    return new URL(String(uri).replace(/^mongodb(\+srv)?:\/\//, 'https://')).hostname
  } catch {
    return ''
  }
}

function redact(uri) {
  return String(uri || '').replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
}

function resolveTargetUri() {
  const fromEnv = String(process.env.TARGET_MONGO_URI || process.env.VB_ATLAS_URI || '').trim()
  if (fromEnv) return fromEnv
  if (fs.existsSync(URI_FILE)) {
    const raw = fs.readFileSync(URI_FILE, 'utf8').trim().split(/\r?\n/).find((l) => l.startsWith('mongodb'))
    if (raw) return raw.trim()
  }
  return ''
}

async function copyAll(sourceUri, targetUri) {
  const source = await mongoose.createConnection(sourceUri, { autoIndex: false }).asPromise()
  const target = await mongoose.createConnection(targetUri, { autoIndex: false }).asPromise()
  try {
    const collections = await source.db.listCollections().toArray()
    const names = collections.map((c) => c.name).filter((n) => !n.startsWith('system.'))
    let docs = 0
    for (const name of names) {
      const batch = await source.db.collection(name).find({}).toArray()
      docs += batch.length
      for (const doc of batch) {
        const { _id, ...rest } = doc
        await target.db.collection(name).updateOne({ _id }, { $set: { ...rest, _id } }, { upsert: true })
      }
      console.log(`  copied ${name}: ${batch.length}`)
    }
    return { collections: names.length, docs }
  } finally {
    await source.close()
    await target.close()
  }
}

async function countUsers(uri) {
  const conn = await mongoose.createConnection(uri, { autoIndex: false }).asPromise()
  try {
    return await conn.db.collection('users').countDocuments()
  } finally {
    await conn.close()
  }
}

async function dropDb(uri) {
  const conn = await mongoose.createConnection(uri, { autoIndex: false }).asPromise()
  try {
    await conn.db.dropDatabase()
    console.log('Dropped source DB', redact(uri))
  } finally {
    await conn.close()
  }
}

async function main() {
  const targetRaw = resolveTargetUri()
  if (!targetRaw) {
    console.error('Missing dedicated VB Atlas URI.')
    console.error(`Create the Atlas project/user, then save the connection string to:\n  ${URI_FILE}`)
    console.error('See docs/ATLAS-VB-PROJECT-CHECKLIST.md')
    process.exit(2)
  }

  const prodVars = loadRailwayVars('production')
  const mgUri = prodVars.MONGO_URI_MG
  if (!mgUri) throw new Error('MONGO_URI_MG missing')

  const sourceUri = withDbName(mgUri, 'ops-dashboard-vb')
  const targetProd = withDbName(targetRaw, 'ops-dashboard')
  const targetStaging = withDbName(targetRaw, 'ops-dashboard-staging')

  const targetHost = hostname(targetProd)
  const mgHost = hostname(mgUri)
  if (!targetHost || targetHost === mgHost) {
    console.error('Target URI must be a different Atlas host than MG (', mgHost, ')')
    console.error('Got:', redact(targetProd))
    process.exit(1)
  }

  console.log('Migrate VB data')
  console.log('  from', redact(sourceUri))
  console.log('  to  ', redact(targetProd))
  const summary = await copyAll(sourceUri, targetProd)
  console.log('Copy summary', summary)

  const users = await countUsers(targetProd)
  if (users < 1) {
    console.error('Target has no users after copy — aborting Railway retarget')
    process.exit(1)
  }
  console.log('Target users:', users)

  // Seed empty staging DB structure (master/config collections only — not operational data)
  console.log('Seed staging DB', redact(targetStaging))
  await copyAll(sourceUri, targetStaging)

  setRailwayUri('production', targetProd)
  setRailwayUri('staging', targetStaging)

  fs.writeFileSync(
    path.join(root, 'scripts', '_tmp-vb-new-host.txt'),
    `${targetHost}\n`,
    { mode: 0o600 },
  )
  console.log('Wrote scripts/_tmp-vb-new-host.txt for safety/docs update')

  if (DROP_SOURCE) {
    await dropDb(sourceUri)
  } else {
    console.log('Source DB retained. Re-run with --drop-source after prod verify.')
  }

  console.log('Done. Wait for Railway redeploy, then verify /api/ready x-tenant:vb')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
