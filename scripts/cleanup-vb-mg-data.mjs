#!/usr/bin/env node
/**
 * Gated VB users cleanup — deletes ONLY explicitly listed VB user _ids.
 * Never touches MG. Never wipes collections.
 *
 *   I_UNDERSTAND=DELETE-VB-USER-IDS npm run cleanup:vb-mg-data -- \
 *     --from-railway --railway-project <id> --ids=<vbUserId>
 */
import { createRequire } from 'node:module'
import dns from 'node:dns'
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
const { getTenantConfig } = require(path.join(root, 'backend', 'config', 'tenantRegistry'))
const { redactMongoUri } = require(path.join(root, 'backend', 'utils', 'mongoUriFingerprint'))

const UNDERSTAND = 'DELETE-VB-USER-IDS'
const PROTECTED_NAMES = new Set(['vbadmin'])
const PROTECTED_EMAILS = new Set(['vbadmin@system.local'])

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function arg(name, fallback = '') {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (hit) return hit.slice(prefix.length)
  const idx = process.argv.indexOf(`--${name}`)
  if (idx >= 0) return process.argv[idx + 1] || fallback
  return fallback
}

function loadRailwayVars(environment = 'production') {
  const projectId = arg('railway-project', process.env.RAILWAY_PROJECT_ID || '')
  const args = ['variable', 'list', '-s', 'ops-dashboard', '-e', environment, '--json']
  if (projectId) args.push('-p', projectId)
  const r = spawnSync('railway', args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const raw = `${r.stdout || ''}\n${r.stderr || ''}`
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) {
    throw new Error(
      `Failed to load Railway vars (${environment}). `
      + 'Link the project (`railway link`) or pass --railway-project <id>.',
    )
  }
  return JSON.parse(raw.slice(start, end + 1))
}

function resolveVbUri() {
  const fromRailway = hasFlag('from-railway')
  const merged = fromRailway
    ? { ...process.env, ...loadRailwayVars('production') }
    : process.env
  const envVar = getTenantConfig('vb')?.envVar || 'MONGO_URI_VB'
  const uri = String(merged[envVar] || '').trim()
  if (!uri) throw new Error(`${envVar} is not set`)
  return uri
}

function parseIds() {
  const raw = arg('ids', '')
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!ids.length) {
    throw new Error('Pass --ids=<vbUserId>[,<vbUserId>...]')
  }
  return [...new Set(ids)]
}

function isProtected(doc) {
  const name = String(doc?.name || '').trim().toLowerCase()
  const email = String(doc?.email || '').trim().toLowerCase()
  return PROTECTED_NAMES.has(name) || PROTECTED_EMAILS.has(email) || name === 'vbadmin'
}

function safeUser(doc) {
  return {
    _id: String(doc._id),
    email: doc.email || '',
    name: doc.name || '',
    role: doc.role || '',
    createdAt: doc.createdAt || null,
  }
}

async function main() {
  if (process.env.I_UNDERSTAND !== UNDERSTAND) {
    console.error(`Refusing: set I_UNDERSTAND=${UNDERSTAND}`)
    console.error('Example:')
    console.error(
      `  I_UNDERSTAND=${UNDERSTAND} npm run cleanup:vb-mg-data -- --from-railway --railway-project <id> --ids=<vbUserId>`,
    )
    process.exit(1)
  }

  const ids = parseIds()
  const uri = resolveVbUri()
  console.log(`VB fingerprint: ${redactMongoUri(uri)}`)
  console.log(`Requested delete ids: ${ids.join(', ')}`)

  const conn = await mongoose.createConnection(uri, {
    autoIndex: false,
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 20000,
  }).asPromise()

  try {
    const users = conn.db.collection('users')
    const totalBefore = await users.countDocuments({})
    const targets = await users
      .find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } })
      .project({ password: 0 })
      .toArray()

    const found = new Map(targets.map((d) => [String(d._id), d]))
    for (const id of ids) {
      if (!found.has(id)) {
        throw new Error(`VB user id not found: ${id}`)
      }
    }

    for (const doc of targets) {
      if (isProtected(doc)) {
        throw new Error(
          `Refusing to delete protected Venus admin: ${JSON.stringify(safeUser(doc))}`,
        )
      }
    }

    if (totalBefore - targets.length < 1) {
      throw new Error(
        `Refusing delete: would leave VB with ${totalBefore - targets.length} users (need at least 1)`,
      )
    }

    console.log('Will delete:')
    for (const doc of targets) console.log(`  ${JSON.stringify(safeUser(doc))}`)

    const result = await users.deleteMany({
      _id: { $in: targets.map((d) => d._id) },
    })
    const totalAfter = await users.countDocuments({})
    console.log(`Deleted ${result.deletedCount} VB user(s). VB users remaining: ${totalAfter}`)
    console.log('Deleted ids:', targets.map((d) => String(d._id)).join(', '))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
